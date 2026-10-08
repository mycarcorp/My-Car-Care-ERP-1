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
import { DiagnosticDetailComponent } from './diagnostic-detail.component';
import { DiagnosticMutationComponent } from './diagnostic-mutation.component';

// The Diagnostic detail route (`/pages/diagnostics/:id`) is guarded by the diagnostic
// view permission, matching the backend ORG_DIAGNOSTIC_* mapping. There is no standalone
// Diagnostic list — the entry point is the Inspection detail page.
const routes: Routes = [
	{
		path: ':id',
		component: DiagnosticDetailComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_DIAGNOSTIC_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	}
];

@NgModule({
	declarations: [DiagnosticDetailComponent, DiagnosticMutationComponent],
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
export class DiagnosticsModule {}
