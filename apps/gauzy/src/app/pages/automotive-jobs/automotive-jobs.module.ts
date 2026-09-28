import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { NbBadgeModule, NbButtonModule, NbCardModule, NbInputModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeMultiSelectModule } from '@gauzy/ui-core/shared';
import { AutomotiveJobsComponent } from './automotive-jobs.component';

const routes: Routes = [{ path: ':repairOrderId', component: AutomotiveJobsComponent }];

@NgModule({
	declarations: [AutomotiveJobsComponent],
	imports: [
		CommonModule,
		FormsModule,
		RouterModule.forChild(routes),
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		EmployeeMultiSelectModule
	]
})
export class AutomotiveJobsModule {}
