import { BadRequestException, Injectable } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import {
	EmployeeAppointmentStatus,
	ID,
	IEmployeeAppointment,
	IEmployeeAppointmentCreateInput,
	PermissionsEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { signPurposeToken, TokenPurposeEnum, verifyPurposeToken } from '../auth/purpose-token';
import { OrganizationContactService } from '../organization-contact/organization-contact.service';
import { VehicleService } from '../vehicle/vehicle.service';
import { TypeOrmEmployeeAppointmentRepository } from './repository/type-orm-employee-appointment.repository';
import { MikroOrmEmployeeAppointmentRepository } from './repository/mikro-orm-employee-appointment.repository';
import { EmployeeAppointment } from './employee-appointment.entity';

@Injectable()
export class EmployeeAppointmentService extends TenantAwareCrudService<EmployeeAppointment> {
	constructor(
		typeOrmEmployeeAppointmentRepository: TypeOrmEmployeeAppointmentRepository,
		mikroOrmEmployeeAppointmentRepository: MikroOrmEmployeeAppointmentRepository,
		private readonly organizationContactService: OrganizationContactService,
		private readonly vehicleService: VehicleService
	) {
		super(typeOrmEmployeeAppointmentRepository, mikroOrmEmployeeAppointmentRepository);
	}

	/**
	 * Finds an employee appointment by its ID.
	 *
	 * @param id - The unique identifier of the employee appointment.
	 * @param relations - An optional array of related entities to include in the query result. Defaults to an empty array.
	 * @returns A promise that resolves to the employee appointment entity, including any specified relations.
	 */
	async findById(id: ID, relations: string[] = []): Promise<IEmployeeAppointment> {
		return await super.findOneByIdString(id, { relations });
	}

	/**
	 * Saves a new employee appointment to the database.
	 *
	 * @param input - The data required to create a new employee appointment, encapsulated in an `IEmployeeAppointmentCreateInput` object.
	 * @returns A promise that resolves to the saved `EmployeeAppointment` entity.
	 */
	async saveAppointment(input: IEmployeeAppointmentCreateInput): Promise<EmployeeAppointment> {
		return await this.save(input);
	}

	async create(entity: Partial<EmployeeAppointment>): Promise<EmployeeAppointment> {
		await this.validateMyCarCareAppointment(entity);
		// Default a new appointment to SCHEDULED unless a valid status was explicitly supplied.
		if (!entity.status) {
			entity.status = EmployeeAppointmentStatus.SCHEDULED;
		}
		return super.create(entity);
	}

	async update(id: ID, entity: Partial<EmployeeAppointment>): Promise<UpdateResult | EmployeeAppointment> {
		const existing = await this.findOneByIdString(id);
		await this.validateMyCarCareAppointment({ ...existing, ...entity });
		this.assertValidStatusTransition(existing.status, entity.status);
		// A transition to CANCELLED requires the dedicated cancel permission (admin-level),
		// on top of the controller's ORG_APPOINTMENT_EDIT gate. Tenant/org scoping is
		// enforced by the findOneByIdString lookup above and the TenantAwareCrudService update.
		if (entity.status === EmployeeAppointmentStatus.CANCELLED && existing.status !== EmployeeAppointmentStatus.CANCELLED) {
			if (!RequestContext.hasPermission(PermissionsEnum.ORG_APPOINTMENT_CANCEL)) {
				throw new BadRequestException('You do not have permission to cancel an appointment.');
			}
		}
		return super.update(id, entity);
	}

	/**
	 * Guards against nonsensical status transitions. A terminal appointment
	 * (COMPLETED or CANCELLED) may not move back to SCHEDULED. All other transitions
	 * remain allowed to preserve existing generic Gauzy appointment behavior.
	 */
	private assertValidStatusTransition(
		currentStatus: EmployeeAppointmentStatus,
		nextStatus: EmployeeAppointmentStatus
	): void {
		if (!nextStatus || nextStatus === currentStatus) {
			return;
		}
		const isTerminal =
			currentStatus === EmployeeAppointmentStatus.COMPLETED ||
			currentStatus === EmployeeAppointmentStatus.CANCELLED;
		if (isTerminal && nextStatus === EmployeeAppointmentStatus.SCHEDULED) {
			throw new BadRequestException(
				`Cannot transition an appointment from ${currentStatus} back to ${EmployeeAppointmentStatus.SCHEDULED}.`
			);
		}
	}

	private async validateMyCarCareAppointment(entity: Partial<EmployeeAppointment>): Promise<void> {
		const hasAutomotiveFields = Boolean(entity.customerId || entity.vehicleId || entity.originalConcern);
		if (!hasAutomotiveFields) {
			return;
		}

		if (!entity.customerId || !entity.vehicleId || !entity.originalConcern?.trim()) {
			throw new BadRequestException(
				'My Car Care appointments require a customer, vehicle, and original customer concern.'
			);
		}

		const [customer, vehicle] = await Promise.all([
			this.organizationContactService.findOneByIdString(entity.customerId),
			this.vehicleService.findOneByIdString(entity.vehicleId)
		]);
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId() ?? entity.organizationId;

		if (
			(tenantId && (customer.tenantId !== tenantId || vehicle.tenantId !== tenantId)) ||
			(organizationId &&
				(customer.organizationId !== organizationId || vehicle.organizationId !== organizationId)) ||
			vehicle.customerId !== customer.id
		) {
			throw new BadRequestException(
				'Appointment customer and vehicle must belong to the current tenant and organization, and the vehicle must belong to the customer.'
			);
		}
	}

	/**
	 * Signs an appointment ID using a JSON Web Token (JWT), for the reschedule link.
	 *
	 * The token is purpose-typed and expires, and it is only issued for an appointment the caller
	 * can read. It used to be an untyped, non-expiring JWT_SECRET token over ANY id the caller
	 * supplied, which other token consumers then accepted as their own (GHSA-28wv-vrxj-rp4q).
	 *
	 * @param id - The ID of the appointment to be signed.
	 * @returns A signed JWT token containing the appointment ID.
	 */
	async signAppointmentId(id: ID): Promise<string> {
		// Tenant-scoped lookup: throws when the appointment is not visible to the caller.
		const appointment = await this.findOneByIdString(id);

		return signPurposeToken(
			TokenPurposeEnum.APPOINTMENT,
			{ appointmentId: appointment.id, tenantId: appointment.tenantId },
			{ expiresIn: EmployeeAppointmentService.getRescheduleTokenLifetime(appointment.endDateTime) }
		);
	}

	/**
	 * Verifies a reschedule-link token and returns the appointment ID it names.
	 *
	 * Links issued before the token was typed carry no purpose and no expiry; they are still
	 * accepted, but only when they name an appointment visible to the caller.
	 *
	 * @param token
	 * @returns The appointment ID.
	 */
	async decodeSignToken(token: string): Promise<ID> {
		let appointmentId: string;
		try {
			({ appointmentId } = verifyPurposeToken<{ appointmentId: string }>(token, TokenPurposeEnum.APPOINTMENT, {
				requiredClaims: ['appointmentId'],
				allowLegacyUntyped: true
			}));
		} catch {
			throw new BadRequestException('Invalid appointment token');
		}

		const appointment = await this.findOneByIdString(appointmentId);
		return appointment.id;
	}

	/**
	 * Reschedule links stay valid until a week after the appointment ends, and at least a day.
	 *
	 * @param endDateTime - When the appointment ends.
	 * @returns The token lifetime in seconds.
	 */
	static getRescheduleTokenLifetime(endDateTime?: Date | string | null, now: number = Date.now()): number {
		const DAY = 24 * 60 * 60;
		const end = endDateTime ? new Date(endDateTime).getTime() : Number.NaN;
		const untilWeekAfterEnd = Number.isFinite(end) ? Math.ceil((end - now) / 1000) + 7 * DAY : 0;
		return Math.max(DAY, untilWeekAfterEnd);
	}
}
