import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NbBadgeModule, NbButtonModule, NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { SmartDataViewLayoutModule } from '@gauzy/ui-core/shared';
import { ServiceCenterDashboardComponent } from './service-center-dashboard.component';

// The Service Center Command Center (`/pages/service-center-dashboard`) is a read-only
// operational dashboard, guarded by the repair-order view permission.
const routes: Routes = [
	{
		path: '',
		component: ServiceCenterDashboardComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_REPAIR_ORDER_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	}
];

@NgModule({
	declarations: [ServiceCenterDashboardComponent],
	imports: [
		CommonModule,
		RouterModule.forChild(routes),
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbSpinnerModule,
		NgxPermissionsModule.forChild(),
		SmartDataViewLayoutModule,
		TranslateModule.forChild()
	]
})
export class ServiceCenterDashboardModule {}
