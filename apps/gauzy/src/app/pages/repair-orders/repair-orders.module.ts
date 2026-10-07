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
import { RepairOrderArrivalComponent } from './repair-order-arrival.component';
import { RepairOrderDetailComponent } from './repair-order-detail.component';
import { RepairOrdersComponent } from './repair-orders.component';

// The Repair Orders list (`/pages/repair-orders`) and detail (`/pages/repair-orders/:id`)
// routes are guarded by the existing repair-order view permission. The list hosts a
// placeholder component until the full UI is built; the detail route resolves to the same
// placeholder for now.
const routes: Routes = [
	{
		path: '',
		component: RepairOrdersComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_REPAIR_ORDER_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	},
	{
		path: ':id',
		component: RepairOrderDetailComponent,
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
	declarations: [RepairOrdersComponent, RepairOrderDetailComponent, RepairOrderArrivalComponent],
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
export class RepairOrdersModule {}
