/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service.
 *
 * `dashboard.entity.ts` applies `@IsEmployeeBelongsToOrganization()` at class-definition time, and
 * that decorator's module reaches the entity graph again through the employee repository. Importing
 * the service first enters the cycle from the wrong end: the decorator module is still initializing
 * when `dashboard.entity.ts` applies it, so it resolves to `undefined` and the whole suite fails to
 * LOAD with `IsEmployeeBelongsToOrganization is not a function`. Loading the entity barrel first
 * lets that module finish before anything applies it. The API does not hit this because Nest
 * bootstraps the entity graph before the service layer.
 */
import '../../core/entities/internal';
import { Test, TestingModule } from '@nestjs/testing';
import { TimerService } from './timer.service';
import { AutomotiveJobLaborStatusEnum, AutomotiveJobStatusEnum } from '@gauzy/contracts';
import { AutomotiveJob } from '../../automotive-job/automotive-job.entity';
import { AutomotiveJobLabor } from '../../automotive-job-labor/automotive-job-labor.entity';

describe('TimerService', () => {
	let service: TimerService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [TimerService]
		})
			/**
			 * `TimerService` has a wide constructor (repositories, command bus, employee service).
			 * The original scaffold provided none of it, so this suite could never have passed even
			 * once it loaded — it would have died on `Nest can't resolve dependencies`. Automocking
			 * every token keeps the suite honest about what it actually checks: that the class is
			 * constructible and its provider wiring is intact.
			 */
			.useMocker(() => ({}))
			.compile();

		service = module.get<TimerService>(TimerService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('automotive labor clock validation', () => {
		let findOne: jest.Mock;
		const employee = { id: 'employee-1' };

		beforeEach(() => {
			findOne = jest.fn(async (entity) =>
				entity === AutomotiveJob
					? {
							id: 'job-1',
							status: AutomotiveJobStatusEnum.IN_PROGRESS,
							assignedEmployeeId: 'employee-default'
						}
					: {
							id: 'labor-1',
							assignedEmployees: [employee],
							status: AutomotiveJobLaborStatusEnum.OPEN
						}
			);
			Object.assign(service, { typeOrmTimeLogRepository: { manager: { findOne } } });
		});

		it('allows the labor-assigned technician even when the job default is another employee', async () => {
			await expect(
				(service as any).validateAutomotiveJobClock(
					{ automotiveJobId: 'job-1', automotiveJobLaborId: 'labor-1' },
					employee,
					'tenant-1',
					'organization-1'
				)
			).resolves.toBeUndefined();
			expect(findOne).toHaveBeenNthCalledWith(1, AutomotiveJob, {
				where: { id: 'job-1', tenantId: 'tenant-1', organizationId: 'organization-1' }
			});
			expect(findOne).toHaveBeenNthCalledWith(2, AutomotiveJobLabor, {
				where: {
					id: 'labor-1',
					automotiveJobId: 'job-1',
					tenantId: 'tenant-1',
					organizationId: 'organization-1'
				},
				relations: { assignedEmployees: true }
			});
		});

		it('rejects a job from another tenant or organization', async () => {
			findOne.mockResolvedValueOnce(null);
			await expect(
				(service as any).validateAutomotiveJobClock(
					{ automotiveJobId: 'foreign-job', automotiveJobLaborId: 'labor-1' },
					employee,
					'tenant-1',
					'organization-1'
				)
			).rejects.toThrow('Automotive job was not found in this organization.');
		});

		it('rejects a labor row assigned to another technician', async () => {
			findOne.mockResolvedValueOnce({
				id: 'job-1',
				status: AutomotiveJobStatusEnum.IN_PROGRESS,
				assignedEmployeeId: 'employee-default'
			});
			findOne.mockResolvedValueOnce({
				id: 'labor-1',
				assignedEmployees: [{ id: 'employee-2' }],
				status: AutomotiveJobLaborStatusEnum.OPEN
			});
			await expect(
				(service as any).validateAutomotiveJobClock(
					{ automotiveJobId: 'job-1', automotiveJobLaborId: 'labor-1' },
					employee,
					'tenant-1',
					'organization-1'
				)
			).rejects.toThrow('Only an assigned labor technician can start this clock.');
		});

		it('rejects starting a clock for completed labor', async () => {
			findOne.mockResolvedValueOnce({
				id: 'job-1',
				status: AutomotiveJobStatusEnum.IN_PROGRESS,
				assignedEmployeeId: employee.id
			});
			findOne.mockResolvedValueOnce({
				id: 'labor-1',
				assignedEmployees: [employee],
				status: AutomotiveJobLaborStatusEnum.COMPLETED
			});
			await expect(
				(service as any).validateAutomotiveJobClock(
					{ automotiveJobId: 'job-1', automotiveJobLaborId: 'labor-1' },
					employee,
					'tenant-1',
					'organization-1'
				)
			).rejects.toThrow('A clock cannot be started for completed or cancelled labor.');
		});
	});
});
