import { api, LightningElement, wire } from 'lwc';
import getOpportunitySiteCameraRows from '@salesforce/apex/OpportunitySiteCameraDataController.getOpportunitySiteCameraRows';
import getEditableFieldConfig from '@salesforce/apex/OpportunitySiteCameraDataController.getEditableFieldConfig';

export default class OpportunitySiteTemplateDownload extends LightningElement {
    @api opportunityId;
    audioTypesRequiredLabel = 'Audio_Type_s_Required__c';
    fieldLabels = {};

    rows = [];
    errorMessage;
    isLoaded = false;

    @wire(getOpportunitySiteCameraRows, { opportunityId: '$opportunityId' })
    wiredRows({ data, error }) {
        if (data) {
            this.isLoaded = true;
            this.rows = data;
            this.errorMessage = undefined;
            return;
        }

        if (error) {
            this.isLoaded = true;
            this.rows = [];
            this.errorMessage = this.normalizeError(error);
        }
    }

    @wire(getEditableFieldConfig)
    wiredFieldConfig({ data }) {
        if (!data) {
            return;
        }
        this.audioTypesRequiredLabel = data.audioTypesRequiredLabel || this.audioTypesRequiredLabel;
        this.fieldLabels = data.fieldLabels || {};
    }

    get hasRows() {
        return this.rows.length > 0;
    }

    get showNoSitesMessage() {
        return this.isLoaded && !this.errorMessage && !this.hasRows;
    }

    handleDownload() {
        const header = [
            'Opportunity Site Id',
            'Account Name',
            'Site Name',
            this.getFieldLabel('totalCamera'),
            this.getFieldLabel('pointOfSaleSystem'),
            this.getFieldLabel('cameraMake'),
            this.getFieldLabel('cameraModel'),
            this.getFieldLabel('cameraMakeCustom'),
            this.getFieldLabel('cameraModelCustom'),
            this.getFieldLabel('dataIntegrationsRequiredOther'),
            this.getFieldLabel('shippingAddressStreet'),
            this.getFieldLabel('shippingAddressCity'),
            this.getFieldLabel('shippingAddressStateCode'),
            this.getFieldLabel('shippingAddressPostalCode'),
            this.getFieldLabel('shippingAddressCountryCode'),
            this.getFieldLabel('whoIsInstalling'),
            this.getFieldLabel('additionalBillingNotes'),
            this.getFieldLabel('nvrDvrUsername'),
            this.getFieldLabel('nvrDvrPassword'),
            this.getFieldLabel('nvrDvrRecordInParallelWithSrd'),
            this.getFieldLabel('nvrDvrRequiredAsPoe'),
            this.getFieldLabel('permissionToResetNvrAndCameras'),
            this.audioTypesRequiredLabel,
            this.getFieldLabel('hmeType'),
            this.getFieldLabel('hmeUsername'),
            this.getFieldLabel('hmePassword'),
            this.getFieldLabel('zoomIp'),
            this.getFieldLabel('siteAddressStreet'),
            this.getFieldLabel('siteAddressCity'),
            this.getFieldLabel('siteAddressStateCode'),
            this.getFieldLabel('siteAddressPostalCode'),
            this.getFieldLabel('siteAddressCountryCode'),
            this.getFieldLabel('siteOpenDate')
        ];

        const csvRows = this.rows.map((row) => [
            row.opportunitySiteId,
            row.accountName,
            row.siteName,
            row.totalCamera,
            row.pointOfSaleSystem,
            row.cameraMake,
            row.cameraModel,
            row.cameraMakeCustom,
            row.cameraModelCustom,
            row.dataIntegrationsRequiredOther,
            row.shippingAddressStreet,
            row.shippingAddressCity,
            row.shippingAddressStateCode,
            row.shippingAddressPostalCode,
            row.shippingAddressCountryCode,
            row.whoIsInstalling,
            row.additionalBillingNotes,
            row.nvrDvrUsername,
            row.nvrDvrPassword,
            row.nvrDvrRecordInParallelWithSrd,
            row.nvrDvrRequiredAsPoe,
            row.permissionToResetNvrAndCameras,
            row.audioTypesRequired,
            row.hmeType,
            row.hmeUsername,
            row.hmePassword,
            row.zoomIp,
            row.siteAddressStreet,
            row.siteAddressCity,
            row.siteAddressStateCode,
            row.siteAddressPostalCode,
            row.siteAddressCountryCode,
            row.siteOpenDate
        ]);

        const csvContent = [header, ...csvRows]
            .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
            .join('\r\n');

        // Use a data URI instead of Blob/createObjectURL to avoid LWS MIME restrictions.
        const encodedContent = encodeURIComponent(`\uFEFF${csvContent}`);
        const downloadUrl = `data:text/plain;charset=utf-8,${encodedContent}`;
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = 'opportunity-site-camera-template.csv';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    }

    getFieldLabel(fieldKey) {
        return this.fieldLabels?.[fieldKey] || fieldKey;
    }

    escapeCsvValue(value) {
        const stringValue = value === null || value === undefined ? '' : String(value);
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    normalizeError(error) {
        if (!error) {
            return 'An unexpected error occurred while loading the download template.';
        }

        if (Array.isArray(error.body)) {
            return error.body.map((item) => item.message).join(', ');
        }

        if (error.body && error.body.message) {
            return error.body.message;
        }

        if (error.message) {
            return error.message;
        }

        return 'An unexpected error occurred while loading the download template.';
    }
}