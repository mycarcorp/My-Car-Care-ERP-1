import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { CustomerFollowUpDetailComponent } from './customer-follow-up-detail.component';
import { CustomerFollowUpsComponent } from './customer-follow-ups.component';

const routes: Routes = [
	{
		path: '',
		component: CustomerFollowUpsComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_CUSTOMER_FOLLOW_UP_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	},
	{
		path: ':id',
		component: CustomerFollowUpDetailComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_CUSTOMER_FOLLOW_UP_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class CustomerFollowUpsRoutingModule {}