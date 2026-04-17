import { api, LightningElement, track, wire } from 'lwc';
import { FlowAttributeChangeEvent, FlowNavigationNextEvent, FlowNavigationBackEvent } from 'lightning/flowSupport';
import { getObjectInfo, getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import { refreshApex } from '@salesforce/apex';
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

// Fields that must have a non-empty value before the form can proceed.
// Each entry: { key: rowProperty, label: displayName, condition: fn(row) | undefined }
const REQUIRED_FIELDS = [
    { key: 'siteAddressStreet', label: 'Site Address Street' },
    { key: 'siteAddressCity', label: 'Site Address City' },
    { key: 'siteAddressStateCode', label: 'Site Address State Code' },
    { key: 'siteAddressPostalCode', label: 'Site Address Postal Code' },
    { key: 'siteAddressCountryCode', label: 'Site Address Country Code' },
    { key: 'totalCamera', label: 'Number of Cameras' },
    { key: 'pointOfSaleSystem', label: 'Point of Sale System' },
    { key: 'cameraMakeCustom', label: 'Camera Make' },
    { key: 'cameraModelCustom', label: 'Camera Model' },
    { key: 'cameraMake', label: 'NVR DVR Make' },
    { key: 'cameraModel', label: 'NVR DVR Model' },
    { key: 'dataIntegrationsRequiredOther', label: 'Data Integrations Required Other' },
    { key: 'whoIsInstalling', label: 'Who is Installing' },
    { key: 'additionalBillingNotes', label: 'Additional Billing Notes' },
    { key: 'shippingAddressStreet', label: 'Shipping Address Street' },
    { key: 'shippingAddressCity', label: 'Shipping Address City' },
    { key: 'shippingAddressStateCode', label: 'Shipping Address State Code' },
    { key: 'shippingAddressPostalCode', label: 'Shipping Address Postal Code' },
    { key: 'shippingAddressCountryCode', label: 'Shipping Address Country Code' },
    { key: 'siteOpenDate', label: 'Site Open Date' },
    { key: 'shippingContactId', label: 'Shipping Contact' },
    { key: 'installContactId', label: 'Install Contact' },
    { key: 'dataContactId', label: 'Data Contact' },
    { key: 'billingContactId', label: 'Billing Contact' },
    { key: 'accountAdministratorContactId', label: 'Account Administrator' },
    // Conditional: only required when NVR DVR Required as POE is checked
    {
        key: 'nvrDvrUsername',
        label: 'NVR DVR Username',
        condition: (row) => row.nvrDvrRequiredAsPoe === true
    },
    {
        key: 'nvrDvrPassword',
        label: 'NVR DVR Password',
        condition: (row) => row.nvrDvrRequiredAsPoe === true
    },
];

export default class OpportunitySiteCameraTable extends LightningElement {
    _opportunityId;
    _updatesJson;
    _pendingEdits = null;

    @api
    get updatesJson() {
        return this._updatesJson;
    }

    set updatesJson(value) {
        this._updatesJson = value;
        // If the Flow is passing back edited data (component re-instantiation after
        // validation failure), restore those edits into _pendingEdits so the wire
        // handler can merge them instead of overwriting with Apex data.
        if (value && !this._initialLoadComplete) {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this._pendingEdits = parsed;
                    this._revalidateOnLoad = true;
                }
            } catch (e) {
                // Ignore parse errors
            }
        }
    }

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
            this.validationErrors = [];
            this.isLoaded = false;
            this._initialLoadComplete = false;
            this._isEdited = false;
            this._pendingEdits = null;
        }
    }

    rawRows = [];
    rows = [];
    fieldConfig = DEFAULT_FIELD_CONFIG;
    errorMessage;
    @track validationErrors = [];
    showValidationBanner = false;
    _scrollToErrors = false;
    _initialLoadComplete = false;
    _isEdited = false;
    _revalidateOnLoad = false;
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
    _wiredRowsResult;
    _needsRefresh = true;

    connectedCallback() {
        this._needsRefresh = true;
    }

    renderedCallback() {
        // After the first render with data loaded, re-run validation to show the
        // banner if this is a re-instantiation after validation failure (detected
        // by having received pending edits via updatesJson setter).
        if (this._revalidateOnLoad && this.isLoaded && this.rows.length > 0) {
            this._revalidateOnLoad = false;
            // Run validation in the next microtask to ensure DOM is settled.
            Promise.resolve().then(() => {
                this.runValidation();
            });
        }

        if (this._scrollToErrors) {
            this._scrollToErrors = false;
            const banner = this.template.querySelector('[data-id="validation-banner"]');
            if (banner) {
                banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

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
        this._wiredRowsResult = value;
        const { data, error } = value;
        this.isLoaded = true;

        if (data) {
            // If we have pending edits from a previous component instance (validation
            // failure scenario), merge them with the fresh Apex data.
            if (this._pendingEdits && this._pendingEdits.length > 0) {
                const editsMap = new Map();
                this._pendingEdits.forEach((edit) => {
                    if (edit.opportunitySiteId) {
                        editsMap.set(edit.opportunitySiteId, edit);
                    }
                });

                this.rawRows = data.map((apexRow) => {
                    const edit = editsMap.get(apexRow.opportunitySiteId);
                    if (edit) {
                        return { ...apexRow, ...edit };
                    }
                    return apexRow;
                });
                this._pendingEdits = null;
                // Protect the merged edits from being overwritten by subsequent wire calls.
                this._isEdited = true;
            } else if (!this._isEdited) {
                // Accept all wire updates (including server-refresh after prior saves)
                // until the user actually starts editing the form.
                this.rawRows = data;
            }

            this._initialLoadComplete = true;
            this.rows = this.buildRows();
            this.errorMessage = undefined;
            if (!this._pendingEdits) {
                this.publishRows();
            }

            // After processing (possibly cached) data, force a server refresh
            // so we pick up any changes saved in a previous session.
            if (this._needsRefresh) {
                this._needsRefresh = false;
                refreshApex(this._wiredRowsResult);
            }
            return;
        }

        if (!this._initialLoadComplete) {
            this.rawRows = [];
            this.rows = [];
            this.publishRows();
        }
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
        this._initialLoadComplete = true;
        this._isEdited = true;
        this.validationErrors = [];
        this.showValidationBanner = false;
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

    runValidation() {
        const siteErrors = [];

        this.rows.forEach((row) => {
            const missingLabels = [];

            REQUIRED_FIELDS.forEach(({ key, label, condition }) => {
                if (condition && !condition(row)) {
                    return;
                }
                const value = row[key];
                const isBlank =
                    value === undefined ||
                    value === null ||
                    (typeof value === 'string' && value.trim() === '') ||
                    (typeof value === 'number' && Number.isNaN(value));
                if (isBlank) {
                    missingLabels.push(label);
                }
            });

            if (missingLabels.length > 0) {
                siteErrors.push({
                    id: row.opportunitySiteId,
                    siteName: row.siteName || 'Unnamed Site',
                    messages: missingLabels,
                    messagesJoined: missingLabels.join(', ')
                });
            }
        });

        // Force reactivity by creating a new array reference
        this.validationErrors = [...siteErrors];
        this.showValidationBanner = siteErrors.length > 0;
        console.log('runValidation complete - showValidationBanner:', this.showValidationBanner, 'errors:', siteErrors.length);
        if (siteErrors.length > 0) {
            this._scrollToErrors = true;
        }
        return siteErrors;
    }

    handlePrevious() {
        this.dispatchEvent(new FlowNavigationBackEvent());
    }

    handleNext() {
        if (!this.hasRows) {
            return;
        }
        const siteErrors = this.runValidation();
        if (siteErrors.length === 0) {
            this.dispatchEvent(new FlowNavigationNextEvent());
        }
        // If errors exist, the banner is shown inline and we do not navigate.
    }

    @api
    validate() {
        // Navigation is controlled by handleNext which runs validation before
        // dispatching FlowNavigationNextEvent. This hook is a safety net only.
        if (!this.hasRows) {
            return {
                isValid: false,
                errorMessage: 'This opportunity has no sites available to update.'
            };
        }
        return { isValid: true };
    }

    isBlankValue(value) {
        return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    }

    publishRows() {
        const json = JSON.stringify(
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
        this._updatesJson = json;
        this.dispatchEvent(new FlowAttributeChangeEvent('updatesJson', json));
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