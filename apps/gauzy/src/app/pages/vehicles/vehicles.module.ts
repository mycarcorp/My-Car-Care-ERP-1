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
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { SmartDataViewLayoutModule } from '@gauzy/ui-core/shared';
import { VehicleDetailComponent } from './vehicle-detail.component';
import { VehicleMutationComponent } from './vehicle-mutation.component';
import { VehiclesComponent } from './vehicles.component';

// The Vehicle list (`/pages/vehicles`) and detail (`/pages/vehicles/:id`) routes are
// guarded by PermissionsGuard. The backend vehicle read endpoints have no dedicated
// read permission (TenantPermissionGuard only), so no `data.permissions.only` is set —
// any authenticated user may view them, matching the backend. Mutations stay gated
// by PermissionsEnum.ALL_ORG_EDIT at the API level and via *ngxPermissionsOnly in
// the templates.
const routes: Routes = [
	{
		path: '',
		component: VehiclesComponent,
		canActivate: [PermissionsGuard]
	},
	{
		path: ':id',
		component: VehicleDetailComponent,
		canActivate: [PermissionsGuard]
	}
];

@NgModule({
	declarations: [VehiclesComponent, VehicleDetailComponent, VehicleMutationComponent],
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
export class VehiclesModule {}
