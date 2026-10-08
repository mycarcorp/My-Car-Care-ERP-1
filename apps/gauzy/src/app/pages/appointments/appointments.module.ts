import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbDialogModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { SmartDataViewLayoutModule } from '@gauzy/ui-core/shared';
import { AppointmentMutationComponent } from './appointment-mutation.component';
import { AppointmentsComponent } from './appointments.component';

// The Service Center appointments list (`/pages/appointments`) is guarded by the
// appointment view permission, matching the backend ORG_APPOINTMENT_* mapping.
const routes: Routes = [
	{
		path: '',
		component: AppointmentsComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_APPOINTMENT_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	}
];

@NgModule({
	declarations: [AppointmentsComponent, AppointmentMutationComponent],
	imports: [
		CommonModule,
		FormsModule,
		RouterModule.forChild(routes),
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbDatepickerModule,
		NbDialogModule.forChild(),
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NgxPermissionsModule.forChild(),
		SmartDataViewLayoutModule,
		TranslateModule.forChild()
	]
})
export class AppointmentsModule {}
