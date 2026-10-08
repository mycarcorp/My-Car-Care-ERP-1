import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
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
import { EstimateDetailComponent } from './estimate-detail.component';
import { EstimateMutationComponent } from './estimate-mutation.component';
import { EstimatesComponent } from './estimates.component';

// The Estimate list (`/pages/estimates`) and detail (`/pages/estimates/:id`) routes are
// guarded by the estimate view permission, matching the backend ORG_ESTIMATE_* mapping.
const routes: Routes = [
	{
		path: '',
		component: EstimatesComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_ESTIMATE_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	},
	{
		path: ':id',
		component: EstimateDetailComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_ESTIMATE_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	}
];

@NgModule({
	declarations: [EstimatesComponent, EstimateDetailComponent, EstimateMutationComponent],
	imports: [
		CommonModule,
		FormsModule,
		RouterModule.forChild(routes),
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule.forChild(),
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NgxPermissionsModule.forChild(),
		SmartDataViewLayoutModule,
		TranslateModule.forChild()
	]
})
export class EstimatesModule {}
