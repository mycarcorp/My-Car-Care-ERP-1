import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormBuilder } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { of } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { InvoicesService, OrganizationSettingService, Store } from '@gauzy/ui-core/core';
import { PaymentMutationComponent } from './payment-mutation.component';

describe('PaymentMutationComponent', () => {
	let component: PaymentMutationComponent;
	let dialogRef: any;

	const organization = {
		id: 'org-1',
		currency: 'USD'
	} as any;

	beforeEach(async () => {
		dialogRef = jasmine.createSpyObj('NbDialogRef', ['close']);

		await TestBed.configureTestingModule({
			imports: [ReactiveFormsModule, TranslateModule.forRoot()],
			providers: [
				UntypedFormBuilder,
				PaymentMutationComponent,
				{ provide: NbDialogRef, useValue: dialogRef },
				{
					provide: Store,
					useValue: {
						user: { tenantId: 'tenant-1' },
						selectedOrganization$: of(organization)
					}
				},
				{
					provide: InvoicesService,
					useValue: {
						getAll: jasmine.createSpy().and.callFake(async () => ({ items: [] }))
					}
				},
				{
					provide: OrganizationSettingService,
					useValue: {
						getDateFromOrganizationSettings: () => new Date('2026-10-15T00:00:00.000Z')
					}
				}
			]
		}).compileComponents();

		component = TestBed.runInInjectionContext(
			() => new PaymentMutationComponent(TestBed.inject(TranslateService), TestBed.inject(UntypedFormBuilder), dialogRef, TestBed.inject(Store), TestBed.inject(InvoicesService), TestBed.inject(OrganizationSettingService))
		);
		component.organization = organization;
		component.invoice = {
			id: 'invoice-1',
			currency: 'USD',
			dueDate: new Date('2026-10-10T00:00:00.000Z')
		} as any;
		component.form.patchValue({
			amount: 125,
			currency: 'USD',
			paymentDate: new Date('2026-10-15T12:00:00.000Z'),
			paymentMethod: 'CASH'
		});
	});

	it('closes once and marks overdue when payment date is after due date', async () => {
		await component.addEditPayment();
		await component.addEditPayment();

		expect(dialogRef.close).toHaveBeenCalledTimes(1);
		expect(dialogRef.close).toHaveBeenCalledWith(
			jasmine.objectContaining({
				overdue: true,
				amount: 125,
				currency: 'USD',
				invoiceId: 'invoice-1',
				organizationId: 'org-1',
				tenantId: 'tenant-1'
			})
		);
	});

	it('does not mark overdue when payment date is on or before the due date', async () => {
		component.isSubmitting = false;
		component.form.patchValue({ paymentDate: new Date('2026-10-10T00:00:00.000Z') });

		await component.addEditPayment();

		expect(dialogRef.close).toHaveBeenCalledWith(
			jasmine.objectContaining({
				overdue: false
			})
		);
	});

	it('prefills the invoice contact into the payment form when creating a new payment', () => {
		component.payment = null;
		component.invoice = {
			...component.invoice,
			toContact: {
				id: 'contact-1',
				name: 'Customer Contact'
			} as any
		};

		component.initializeForm();

		expect(component.form.get('organizationContact').value).toEqual(
			jasmine.objectContaining({ id: 'contact-1', name: 'Customer Contact' })
		);
	});
});