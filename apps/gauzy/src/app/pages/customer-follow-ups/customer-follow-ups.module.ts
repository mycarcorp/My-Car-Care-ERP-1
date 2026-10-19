import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
	NbAccordionModule,
	NbAlertModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { CustomerFollowUpApiService } from './customer-follow-up-api.service';
import { CustomerFollowUpDetailComponent } from './customer-follow-up-detail.component';
import { CustomerFollowUpFormComponent } from './customer-follow-up-form.component';
import { CustomerFollowUpsComponent } from './customer-follow-ups.component';
import { CustomerFollowUpsRoutingModule } from './customer-follow-ups-routing.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		RouterModule,
		CustomerFollowUpsRoutingModule,
		NbAccordionModule,
		NbAlertModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbDatepickerModule,
		NbIconModule,
		NbInputModule,
		NbListModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTooltipModule,
		NgxPermissionsModule.forChild()
	],
	declarations: [CustomerFollowUpsComponent, CustomerFollowUpDetailComponent, CustomerFollowUpFormComponent],
	providers: [CustomerFollowUpApiService]
})
export class CustomerFollowUpsModule {}