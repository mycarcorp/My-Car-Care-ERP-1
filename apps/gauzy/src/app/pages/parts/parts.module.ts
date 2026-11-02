import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { NbBadgeModule, NbButtonModule, NbCardModule, NbCheckboxModule, NbInputModule, NbRadioModule, NbSelectModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { PartAdjustmentComponent } from './part-adjustment.component';
import { PartDetailComponent } from './part-detail.component';
import { PartMutationComponent } from './part-mutation.component';
import { PartsComponent } from './parts.component';

// Parts & Inventory list (`/pages/parts`) and detail (`/pages/parts/:id`).
// Backend read endpoints require ORG_INVENTORY_VIEW; mutations require
// ORG_INVENTORY_PRODUCT_EDIT at the API level.
const routes: Routes = [
	{
		path: '',
		component: PartsComponent,
		canActivate: [PermissionsGuard],
		data: { permissions: { only: [PermissionsEnum.ORG_INVENTORY_VIEW], redirectTo: '/pages/dashboard' } }
	},
	{
		path: ':id',
		component: PartDetailComponent,
		canActivate: [PermissionsGuard],
		data: { permissions: { only: [PermissionsEnum.ORG_INVENTORY_VIEW], redirectTo: '/pages/dashboard' } }
	}
];

@NgModule({
        declarations: [PartsComponent, PartDetailComponent, PartMutationComponent, PartAdjustmentComponent],
        imports: [
                CommonModule,
                FormsModule,
                RouterModule.forChild(routes),
                NbBadgeModule,
                NbButtonModule,
                NbCardModule,
                NbCheckboxModule,
                NbInputModule,
                NbRadioModule,
                NbSelectModule,
                NbSpinnerModule,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild()
	]
})
export class PartsModule {}
