import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbToggleModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeMultiSelectModule } from '@gauzy/ui-core/shared';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { AutomotiveJobCategoriesComponent } from './automotive-job-categories.component';
import { AutomotiveJobsComponent } from './automotive-jobs.component';

const routes: Routes = [
	{
		path: 'categories',
		component: AutomotiveJobCategoriesComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_AUTOMOTIVE_JOB_CATEGORIES_EDIT],
				redirectTo: '/pages/dashboard'
			}
		}
	},
	{ path: ':repairOrderId', component: AutomotiveJobsComponent }
];

@NgModule({
	declarations: [AutomotiveJobsComponent, AutomotiveJobCategoriesComponent],
	imports: [
		CommonModule,
		FormsModule,
		RouterModule.forChild(routes),
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbSelectModule,
		NbToggleModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		EmployeeMultiSelectModule
	]
})
export class AutomotiveJobsModule {}
