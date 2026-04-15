import { api, LightningElement, wire } from 'lwc';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';
import { getObjectInfo, getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import SITE_OBJECT from '@salesforce/schema/Site__c';
import getOpportunitySiteCameraRows from '@salesforce/apex/OpportunitySiteCameraDataController.getOpportunitySiteCameraRows';
import getEditableFieldConfig from '@salesforce/apex/OpportunitySiteCameraDataController.getEditableFieldConfig';
import createContactForOpportunity from '@salesforce/apex/OpportunitySiteCameraDataController.createContactForOpportunity';

const DEFAULT_FIELD_CONFIG = {
    pointOfSaleSystemOptions: [],
    whoIsInstallingOptions: [],
    siteAddressStateCodeOptions: [],
    siteAddressStateOptionsByCountry: {},
    siteAddressCountryCodeOptions: [],
    audioTypesRequiredLabel: 'Audio Type(s) Required',
    audioTypesRequiredOptions: [],
    fieldLabels: {
        siteAddressStreet: 'Street',
        siteAddressCity: 'City',
        siteAddressStateCode: 'State Code',
        siteAddressPostalCode: 'Postal Code',
        siteAddressCountryCode: 'Country Code',
        totalCamera: 'Number of Cameras',
        pointOfSaleSystem: 'Point of Sale System',
        siteOpenDate: 'Site Open Date',
        nvrDvrRequiredAsPoe: 'NVR DVR Required as POE',
        nvrDvrRecordInParallelWithSrd: 'NVR DVR Record In Parallel With SRD',
        permissionToResetNvrAndCameras: 'Permission to Reset NVR and Cameras',
        cameraMake: 'NVR DVR Make',
        cameraModel: 'NVR DVR Model',
        cameraMakeCustom: 'Camera Make',
        cameraModelCustom: 'Camera Model',
        dataIntegrationsRequiredOther: 'Data Integrations Required Other',
        shippingAddressStreet: 'Shipping Address Street',
        shippingAddressCity: 'Shipping Address City',
        shippingAddressStateCode: 'Shipping Address State Code',
        shippingAddressPostalCode: 'Shipping Address Postal Code',
        shippingAddressCountryCode: 'Shipping Address Country Code',
        sameAsSiteAddress: 'Same as site addess',
        whoIsInstalling: 'Who is Installing',
        additionalBillingNotes: 'Additional Billing Notes',
        nvrDvrUsername: 'NVR DVR Username',
        nvrDvrPassword: 'NVR DVR Password',
        hmeType: 'HME Type',
        hmeUsername: 'HME Username',
        hmePassword: 'HME Password',
        headsetAudioType: 'Headset Audio Type',
        zoomIp: 'Zoom IP',
        shippingContact: 'Shipping Contact',
        installContact: 'Install Contact',
        dataContact: 'Data Contact',
        billingContact: 'Billing Contact',
        accountAdministratorContact: 'Account Administrator'
    }
};

const CONTACT_ROLE_OPTIONS = [
    { label: 'Shipping Contact', value: 'shippingContactId' },
    { label: 'Install Contact', value: 'installContactId' },
    { label: 'Data Contact', value: 'dataContactId' },
    { label: 'Billing Contact', value: 'billingContactId' },
    { label: 'Account Administrator', value: 'accountAdministratorContactId' }
];

export default class OpportunitySiteCameraTable extends LightningElement {
    _opportunityId;
    @api updatesJson;

    @api
    get opportunityId() {
        return this._opportunityId;
    }

    set opportunityId(value) {
        const previousOpportunityId = this._opportunityId;
        this._opportunityId = this.normalizeOpportunityId(value);

        // Reset transient UI state when the resolved id changes.
        if (previousOpportunityId !== this._opportunityId) {
            this.errorMessage = undefined;
            this.validationMessage = undefined;
            this.isLoaded = false;
        }
    }

    rawRows = [];
    rows = [];
    fieldConfig = DEFAULT_FIELD_CONFIG;
    errorMessage;
    validationMessage;
    isLoaded = false;
    isCreateContactModalOpen = false;
    createContactRowId;
    createContactRoleField = 'shippingContactId';
    createContactFirstName = '';
    createContactLastName = '';
    createContactEmail = '';
    createContactPhone = '';
    createContactError;

    objectInfo;

    @wire(getObjectInfo, { objectApiName: SITE_OBJECT })
    wiredObjectInfo(value) {
        this.objectInfo = value.data;
    }

    get siteRecordTypeId() {
        return this.objectInfo?.defaultRecordTypeId;
    }

    @wire(getPicklistValuesByRecordType, { objectApiName: SITE_OBJECT, recordTypeId: '$siteRecordTypeId' })
    wiredPicklistValuesByRecordType({ data }) {
        if (!data) {
            return;
        }

        const stateOptionsByCountry = this.buildStateOptionsByCountry(data.picklistFieldValues);
        this.fieldConfig = {
            ...this.fieldConfig,
            siteAddressStateOptionsByCountry: stateOptionsByCountry
        };
        this.rows = this.buildRows();
    }

    get wiredOpportunityId() {
        // Returning undefined prevents the wire call until id is available.
        return this.opportunityId || undefined;
    }

    @wire(getOpportunitySiteCameraRows, { opportunityId: '$wiredOpportunityId' })
    wiredRows(value) {
        const { data, error } = value;
        this.isLoaded = true;

        if (data) {
            this.rawRows = data;
            this.rows = this.buildRows();
            this.errorMessage = undefined;
            this.validationMessage = undefined;
            this.publishRows();
            return;
        }

        this.rawRows = [];
        this.rows = [];
        this.publishRows();
        this.errorMessage = this.normalizeError(error);
    }

    @wire(getEditableFieldConfig)
    wiredFieldConfig({ data }) {
        if (!data) {
            return;
        }

        this.fieldConfig = {
            pointOfSaleSystemOptions: data.pointOfSaleSystemOptions || [],
            whoIsInstallingOptions: data.whoIsInstallingOptions || [],
            siteAddressStateCodeOptions: data.siteAddressStateCodeOptions || [],
            siteAddressStateOptionsByCountry: this.fieldConfig.siteAddressStateOptionsByCountry || {},
            siteAddressCountryCodeOptions: data.siteAddressCountryCodeOptions || [],
            audioTypesRequiredLabel: data.audioTypesRequiredLabel || DEFAULT_FIELD_CONFIG.audioTypesRequiredLabel,
            audioTypesRequiredOptions: data.audioTypesRequiredOptions || [],
            fieldLabels: {
                ...DEFAULT_FIELD_CONFIG.fieldLabels,
                ...(data.fieldLabels || {})
            }
        };
        this.rows = this.buildRows();
    }

    get hasRows() {
        return this.rows.length > 0;
    }

    get showNoSitesMessage() {
        return this.isLoaded && !this.errorMessage && !this.hasRows;
    }

    get accountName() {
        return this.rows.length > 0 ? this.rows[0].accountName : '';
    }

    get siteCount() {
        return this.rows.length;
    }

    buildRows() {
        return this.rawRows.map((row) => {
            const normalizedRow = {
                opportunitySiteId: row.opportunitySiteId,
                siteId: row.siteId,
                accountId: row.accountId || '',
                accountName: row.accountName || '',
                siteName: row.siteName || '',
                totalCamera: row.totalCamera,
                pointOfSaleSystem: row.pointOfSaleSystem || '',
                cameraMake: row.cameraMake || '',
                cameraModel: row.cameraModel || '',
                cameraMakeCustom: row.cameraMakeCustom || '',
                cameraModelCustom: row.cameraModelCustom || '',
                dataIntegrationsRequiredOther: row.dataIntegrationsRequiredOther || '',
                shippingAddressStreet: row.shippingAddressStreet || '',
                shippingAddressCity: row.shippingAddressCity || '',
                shippingAddressStateCode: row.shippingAddressStateCode || '',
                shippingAddressPostalCode: row.shippingAddressPostalCode || '',
                shippingAddressCountryCode: row.shippingAddressCountryCode || '',
                sameAsSiteAddress: this.isSameAsSiteAddress(row),
                whoIsInstalling: row.whoIsInstalling || '',
                additionalBillingNotes: row.additionalBillingNotes || '',
                nvrDvrUsername: row.nvrDvrUsername || '',
                nvrDvrPassword: row.nvrDvrPassword || '',
                nvrDvrRecordInParallelWithSrd: row.nvrDvrRecordInParallelWithSrd || false,
                nvrDvrRequiredAsPoe: row.nvrDvrRequiredAsPoe || false,
                permissionToResetNvrAndCameras: row.permissionToResetNvrAndCameras || false,
                headsetAudioType: row.headsetAudioType || '',
                hmeType: row.hmeType || '',
                hmeUsername: row.hmeUsername || '',
                hmePassword: row.hmePassword || '',
                zoomIp: row.zoomIp || '',
                siteAddress: row.siteAddress || '',
                siteAddressStreet: row.siteAddressStreet || '',
                siteAddressCity: row.siteAddressCity || '',
                siteAddressPostalCode: row.siteAddressPostalCode || '',
                siteAddressCountryCode: row.siteAddressCountryCode || '',
                siteAddressStateCode: row.siteAddressStateCode || '',
                siteOpenDate: row.siteOpenDate || '',
                audioTypesRequired: row.audioTypesRequired || '',
                shippingContactId: row.shippingContactId || '',
                shippingContactName: row.shippingContactName || '',
                installContactId: row.installContactId || '',
                installContactName: row.installContactName || '',
                dataContactId: row.dataContactId || '',
                dataContactName: row.dataContactName || '',
                billingContactId: row.billingContactId || '',
                billingContactName: row.billingContactName || '',
                accountAdministratorContactId: row.accountAdministratorContactId || '',
                accountAdministratorContactName: row.accountAdministratorContactName || ''
            };

            const pointOfSaleSystemOptions = this.mergeOptions(
                this.fieldConfig.pointOfSaleSystemOptions,
                normalizedRow.pointOfSaleSystem
            );
            const baseStateOptions = this.getStateOptionsForCountry(normalizedRow.siteAddressCountryCode);
            const siteAddressStateCodeOptions = this.mergeOptions(baseStateOptions, normalizedRow.siteAddressStateCode);
            const siteAddressCountryCodeOptions = this.mergeOptions(
                this.fieldConfig.siteAddressCountryCodeOptions,
                normalizedRow.siteAddressCountryCode
            );
            const audioTypesRequiredOptions = this.mergeOptions(
                this.fieldConfig.audioTypesRequiredOptions,
                normalizedRow.audioTypesRequired
            );
            const whoIsInstallingOptions = this.mergeOptions(
                this.fieldConfig.whoIsInstallingOptions,
                normalizedRow.whoIsInstalling
            );

            return {
                ...normalizedRow,
                sectionKey: normalizedRow.opportunitySiteId,
                contactLookupFilter: normalizedRow.accountId
                    ? {
                          criteria: [
                              {
                                  fieldPath: 'AccountId',
                                  operator: 'eq',
                                  value: normalizedRow.accountId
                              }
                          ]
                      }
                    : undefined,
                showHeadsetAudioType: (normalizedRow.audioTypesRequired || '').trim().toLowerCase() === 'headset audio',
                showHmeCredentialsFields: !!(normalizedRow.hmeType || '').trim(),
                showHeadsetDependentFields: !!(normalizedRow.headsetAudioType || '').trim(),
                pointOfSaleSystemOptions,
                hasPointOfSaleSystemOptions: pointOfSaleSystemOptions.length > 0,
                siteAddressStateCodeOptions,
                hasSiteAddressStateCodeOptions: siteAddressStateCodeOptions.length > 0,
                siteAddressCountryCodeOptions,
                hasSiteAddressCountryCodeOptions: siteAddressCountryCodeOptions.length > 0,
                audioTypesRequiredLabel: this.fieldConfig.audioTypesRequiredLabel,
                audioTypesRequiredOptions,
                hasAudioTypesRequiredOptions: audioTypesRequiredOptions.length > 0,
                whoIsInstallingOptions,
                hasWhoIsInstallingOptions: whoIsInstallingOptions.length > 0,
                fieldLabels: this.fieldConfig.fieldLabels
            };
        });
    }

    mergeOptions(baseOptions = [], currentValue, currentLabel) {
        const options = baseOptions.map((option) => ({ ...option }));
        if (!currentValue) {
            return options;
        }

        const hasCurrentValue = options.some((option) => option.value === currentValue);
        if (!hasCurrentValue) {
            options.push({ label: currentLabel || currentValue, value: currentValue });
        }

        return options;
    }

    getStateOptionsForCountry(countryCode) {
        if (!countryCode) {
            return this.fieldConfig.siteAddressStateCodeOptions;
        }

        const optionsByCountry = this.fieldConfig.siteAddressStateOptionsByCountry || {};
        return optionsByCountry[countryCode] || [];
    }

    buildStateOptionsByCountry(picklistFieldValues = {}) {
        const countryField = picklistFieldValues.Site_Address__CountryCode__s;
        const stateField = picklistFieldValues.Site_Address__StateCode__s;
        if (!countryField || !stateField) {
            return {};
        }

        const countryOptions = countryField.values || [];
        const stateOptions = stateField.values || [];
        const controllerValues = stateField.controllerValues || {};
        const optionsByCountry = {};

        countryOptions.forEach((countryOption) => {
            const controllingIndex = controllerValues[countryOption.value];
            if (controllingIndex === undefined) {
                optionsByCountry[countryOption.value] = [];
                return;
            }

            optionsByCountry[countryOption.value] = stateOptions
                .filter((stateOption) => (stateOption.validFor || []).includes(controllingIndex))
                .map((stateOption) => ({ label: stateOption.label, value: stateOption.value }));
        });

        return optionsByCountry;
    }

    handleFieldChange(event) {
        const rowId = event.target.dataset.rowId;
        const fieldName = event.target.dataset.field;
        let fieldValue;
        if (event.target.type === 'checkbox') {
            fieldValue = event.target.checked;
        } else if (event.detail && Object.prototype.hasOwnProperty.call(event.detail, 'recordId')) {
            fieldValue = event.detail.recordId;
        } else {
            fieldValue = event.detail.value;
        }

        if (fieldName === 'sameAsSiteAddress') {
            this.rawRows = this.rawRows.map((row) => {
                if (row.opportunitySiteId !== rowId) {
                    return row;
                }
                if (!fieldValue) {
                    return { ...row, sameAsSiteAddress: false };
                }
                return {
                    ...row,
                    sameAsSiteAddress: true,
                    shippingAddressStreet: row.siteAddressStreet || '',
                    shippingAddressCity: row.siteAddressCity || '',
                    shippingAddressStateCode: row.siteAddressStateCode || '',
                    shippingAddressPostalCode: row.siteAddressPostalCode || '',
                    shippingAddressCountryCode: row.siteAddressCountryCode || ''
                };
            });
            this.rows = this.buildRows();
            this.publishRows();
            return;
        }

        if (fieldName === 'totalCamera' && fieldValue !== '' && fieldValue !== null && fieldValue !== undefined) {
            fieldValue = Number(fieldValue);
        }

        this.rawRows = this.rawRows.map((row) => {
            if (row.opportunitySiteId !== rowId) {
                return row;
            }

            const updatedRow = { ...row, [fieldName]: fieldValue };
            if (row.sameAsSiteAddress && this.isSiteAddressField(fieldName)) {
                updatedRow.shippingAddressStreet = updatedRow.siteAddressStreet || '';
                updatedRow.shippingAddressCity = updatedRow.siteAddressCity || '';
                updatedRow.shippingAddressStateCode = updatedRow.siteAddressStateCode || '';
                updatedRow.shippingAddressPostalCode = updatedRow.siteAddressPostalCode || '';
                updatedRow.shippingAddressCountryCode = updatedRow.siteAddressCountryCode || '';
            }
            return updatedRow;
        });
        this.rows = this.buildRows();
        this.validationMessage = undefined;
        this.publishRows();
    }

    isSiteAddressField(fieldName) {
        return [
            'siteAddressStreet',
            'siteAddressCity',
            'siteAddressStateCode',
            'siteAddressPostalCode',
            'siteAddressCountryCode'
        ].includes(fieldName);
    }

    isSameAsSiteAddress(row) {
        return (
            (row.siteAddressStreet || '') === (row.shippingAddressStreet || '') &&
            (row.siteAddressCity || '') === (row.shippingAddressCity || '') &&
            (row.siteAddressStateCode || '') === (row.shippingAddressStateCode || '') &&
            (row.siteAddressPostalCode || '') === (row.shippingAddressPostalCode || '') &&
            (row.siteAddressCountryCode || '') === (row.shippingAddressCountryCode || '')
        );
    }

    openCreateContactModal(event) {
        this.createContactRowId = event.target.dataset.rowId;
        this.createContactRoleField = 'shippingContactId';
        this.createContactFirstName = '';
        this.createContactLastName = '';
        this.createContactEmail = '';
        this.createContactPhone = '';
        this.createContactError = undefined;
        this.isCreateContactModalOpen = true;
    }

    closeCreateContactModal() {
        this.isCreateContactModalOpen = false;
    }

    get createContactRoleOptions() {
        return CONTACT_ROLE_OPTIONS;
    }

    handleCreateContactFieldChange(event) {
        const field = event.target.dataset.field;
        const value = event.detail?.value;
        if (field === 'role') {
            this.createContactRoleField = value;
            return;
        }
        if (field === 'firstName') {
            this.createContactFirstName = value;
            return;
        }
        if (field === 'lastName') {
            this.createContactLastName = value;
            return;
        }
        if (field === 'email') {
            this.createContactEmail = value;
            return;
        }
        if (field === 'phone') {
            this.createContactPhone = value;
        }
    }

    async handleCreateContact() {
        this.createContactError = undefined;
        if (
            !this.createContactFirstName ||
            !this.createContactLastName ||
            !this.createContactEmail ||
            !this.createContactPhone
        ) {
            this.createContactError = 'First Name, Last Name, Email, and Phone are required.';
            return;
        }

        try {
            const newContact = await createContactForOpportunity({
                opportunityId: this.opportunityId,
                firstName: this.createContactFirstName,
                lastName: this.createContactLastName,
                email: this.createContactEmail,
                phone: this.createContactPhone
            });

            this.rawRows = this.rawRows.map((row) =>
                row.opportunitySiteId === this.createContactRowId
                    ? {
                          ...row,
                          [this.createContactRoleField]: newContact.value
                      }
                    : row
            );
            this.rows = this.buildRows();
            this.publishRows();
            this.closeCreateContactModal();
        } catch (error) {
            this.createContactError = this.normalizeError(error);
        }
    }

    @api
    validate() {
        if (!this.hasRows) {
            this.validationMessage = 'This opportunity has no sites available to update.';
            return {
                isValid: false,
                errorMessage: this.validationMessage
            };
        }

        const requiredFields = [
            'totalCamera',
            'pointOfSaleSystem',
            'siteOpenDate',
            'cameraMakeCustom',
            'cameraModelCustom',
            'dataIntegrationsRequiredOther',
            'siteAddressStreet',
            'siteAddressCity',
            'siteAddressStateCode',
            'siteAddressPostalCode',
            'siteAddressCountryCode',
            'shippingAddressStreet',
            'shippingAddressCity',
            'shippingAddressStateCode',
            'shippingAddressPostalCode',
            'shippingAddressCountryCode',
            'whoIsInstalling',
            'additionalBillingNotes',
            'shippingContactId',
            'installContactId',
            'dataContactId',
            'billingContactId',
            'accountAdministratorContactId'
        ];

        const nvrRequiredFields = [
            'cameraMake',
            'cameraModel',
            'nvrDvrRecordInParallelWithSrd',
            'permissionToResetNvrAndCameras',
            'nvrDvrUsername',
            'nvrDvrPassword'
        ];
        const invalidSiteNames = [];

        this.rows.forEach((row) => {
            const hasMissingRequiredField = requiredFields.some((fieldName) => this.isBlankValue(row[fieldName]));
            const hasMissingNvrField =
                row.nvrDvrRequiredAsPoe && nvrRequiredFields.some((fieldName) => this.isBlankValue(row[fieldName]));

            if (hasMissingRequiredField || hasMissingNvrField) {
                invalidSiteNames.push(row.siteName || 'Unnamed Site');
            }
        });

        if (invalidSiteNames.length > 0) {
            const uniqueInvalidSites = [...new Set(invalidSiteNames)];
            this.validationMessage = `Please complete all required fields before continuing. Missing values found for: ${uniqueInvalidSites.join(
                ', '
            )}.`;
            return {
                isValid: false,
                errorMessage: this.validationMessage
            };
        }

        this.validationMessage = undefined;
        return { isValid: true };
    }

    get displayedErrorMessage() {
        return this.validationMessage || this.errorMessage;
    }

    isBlankValue(value) {
        return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    }

    publishRows() {
        this.updatesJson = JSON.stringify(
            this.rows.map((row) => ({
                opportunitySiteId: row.opportunitySiteId,
                siteId: row.siteId,
                totalCamera: row.totalCamera === '' || row.totalCamera === undefined ? null : row.totalCamera,
                pointOfSaleSystem: row.pointOfSaleSystem,
                cameraMake: row.cameraMake,
                cameraModel: row.cameraModel,
                cameraMakeCustom: row.cameraMakeCustom,
                cameraModelCustom: row.cameraModelCustom,
                dataIntegrationsRequiredOther: row.dataIntegrationsRequiredOther,
                shippingAddressStreet: row.shippingAddressStreet,
                shippingAddressCity: row.shippingAddressCity,
                shippingAddressStateCode: row.shippingAddressStateCode,
                shippingAddressPostalCode: row.shippingAddressPostalCode,
                shippingAddressCountryCode: row.shippingAddressCountryCode,
                whoIsInstalling: row.whoIsInstalling,
                additionalBillingNotes: row.additionalBillingNotes,
                nvrDvrUsername: row.nvrDvrUsername,
                nvrDvrPassword: row.nvrDvrPassword,
                nvrDvrRecordInParallelWithSrd: row.nvrDvrRecordInParallelWithSrd,
                nvrDvrRequiredAsPoe: row.nvrDvrRequiredAsPoe,
                permissionToResetNvrAndCameras: row.permissionToResetNvrAndCameras,
                headsetAudioType: row.headsetAudioType,
                hmeType: row.hmeType,
                hmeUsername: row.hmeUsername,
                hmePassword: row.hmePassword,
                audioTypesRequired: row.audioTypesRequired,
                zoomIp: row.zoomIp,
                siteAddressStreet: row.siteAddressStreet,
                siteAddressCity: row.siteAddressCity,
                siteAddressPostalCode: row.siteAddressPostalCode,
                siteAddressCountryCode: row.siteAddressCountryCode,
                siteAddressStateCode: row.siteAddressStateCode,
                siteOpenDate: row.siteOpenDate ? row.siteOpenDate : null,
                shippingContactId: row.shippingContactId || null,
                installContactId: row.installContactId || null,
                dataContactId: row.dataContactId || null,
                billingContactId: row.billingContactId || null,
                accountAdministratorContactId: row.accountAdministratorContactId || null
            }))
        );
        this.dispatchEvent(new FlowAttributeChangeEvent('updatesJson', this.updatesJson));
    }

    normalizeError(error) {
        if (!error) {
            return 'An unexpected error occurred while loading the site rows.';
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

        return 'An unexpected error occurred while loading the site rows.';
    }

    normalizeOpportunityId(value) {
        const normalizedValue = value === null || value === undefined ? '' : String(value).trim();
        return /^[a-zA-Z0-9]{15,18}$/.test(normalizedValue) ? normalizedValue : null;
    }
}