import { api, LightningElement, wire } from 'lwc';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';

const FLOW_API_NAME = 'Manage_Opportunity_Site_Camera_Data';

export default class ManageOpportunitySiteCameraDataWrapper extends NavigationMixin(LightningElement) {
    @api recordId;

    pageRef;
    resolvedRecordId;
    resolvedOppId;

    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        this.pageRef = pageRef;
        this.resolveInputs();
    }

    connectedCallback() {
        this.resolveInputs();
    }

    get flowApiName() {
        return FLOW_API_NAME;
    }

    get hasResolvedId() {
        return Boolean(this.resolvedRecordId || this.resolvedOppId);
    }

    get inputVariables() {
        const variables = [];

        if (this.resolvedRecordId) {
            variables.push({
                name: 'recordId',
                type: 'String',
                value: this.resolvedRecordId
            });
        }

        if (this.resolvedOppId) {
            variables.push({
                name: 'oppId',
                type: 'String',
                value: this.resolvedOppId
            });
        }

        return variables;
    }

    resolveInputs() {
        const state = this.pageRef?.state || {};
        const urlParams = this.extractUrlParams();

        this.resolvedRecordId =
            this.recordId ||
            state.recordId ||
            state.c__recordId ||
            urlParams.recordId ||
            undefined;

        this.resolvedOppId =
            state.oppId ||
            state.c__oppId ||
            urlParams.oppId ||
            this.resolvedRecordId ||
            undefined;
    }

    handleFlowStatusChange(event) {
        const status = event.detail?.status;
        if (status !== 'FINISHED' && status !== 'FINISHED_SCREEN') {
            return;
        }

        const opportunityId = this.resolvedOppId || this.resolvedRecordId;
        if (!opportunityId) {
            return;
        }

        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: opportunityId,
                objectApiName: 'Opportunity',
                actionName: 'view'
            }
        });
    }

    extractUrlParams() {
        if (typeof window === 'undefined') {
            return {};
        }

        const href = window.location.href || '';
        const searchParams = new URLSearchParams(window.location.search || '');
        const pathMatch = href.match(/(?:\/|\?|&)oppId=([a-zA-Z0-9]{15,18})/i);
        const recordMatch = href.match(/(?:\/|\?|&)recordId=([a-zA-Z0-9]{15,18})/i);

        return {
            oppId: searchParams.get('oppId') || searchParams.get('c__oppId') || (pathMatch ? pathMatch[1] : null),
            recordId:
                searchParams.get('recordId') ||
                searchParams.get('c__recordId') ||
                (recordMatch ? recordMatch[1] : null)
        };
    }
}