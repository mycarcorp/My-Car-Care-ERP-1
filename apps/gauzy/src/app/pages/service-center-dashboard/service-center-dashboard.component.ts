import { Component, OnDestroy, OnInit } from '@angular/core';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ServiceCenterDashboardApiService, ServiceCenterSummary } from './service-center-dashboard-api.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-service-center-dashboard',
	templateUrl: './service-center-dashboard.component.html',
	styleUrls: ['./service-center-dashboard.component.scss'],
	standalone: false
})
export class ServiceCenterDashboardComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public summary: ServiceCenterSummary;
	public loading = false;
	public organization: IOrganization;

	constructor(
		public readonly translateService: TranslateService,
		private readonly api: ServiceCenterDashboardApiService,
		private readonly store: Store,
		private readonly toastrService: NbToastrService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				debounceTime(200),
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.load()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** Loads the read-only Command Center summary. */
	async load(): Promise<void> {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			this.summary = await this.api.getSummary();
		} catch (error) {
			this.toastrService.danger(
				error?.message || this.getTranslation('SERVICE_CENTER_DASHBOARD.LOAD_FAILED'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.loading = false;
		}
	}

	/** KPI accessor (empty-safe). */
	get kpis(): ServiceCenterSummary['kpis'] | undefined {
		return this.summary?.kpis;
	}

	/** True when a metric is not reliably derivable (omitted by the backend). */
	isLimited(key: string): boolean {
		return (this.summary?.limitations ?? []).includes(key);
	}

	ngOnDestroy(): void {}
}
