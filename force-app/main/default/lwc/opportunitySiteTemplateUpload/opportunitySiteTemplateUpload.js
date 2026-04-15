import { api, LightningElement } from 'lwc';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';

const AUDIO_TYPES_REQUIRED_HEADERS = ['Audio Type(s) Required', 'Audio_Type_s_Required__c', 'Headset Audio Type'];

const REQUIRED_HEADERS = [
    'Opportunity Site Id',
    'Number of Cameras',
    'Point of Sale System',
    'NVR DVR Make',
    'NVR DVR Model',
    'Camera Make',
    'Camera Model',
    'Data integrations required other',
    'Shipping Address Street',
    'Shipping Address City',
    'Shipping Address State Code',
    'Shipping Address Postal Code',
    'Shipping Address Country Code',
    'Who is Installing',
    'Additional billing notes',
    'NVR DVR Username',
    'NVR DVR Password',
    'NVR DVR Record In Parallel With SRD',
    'NVR DVR Required as POE',
    'Permission to Reset NVR and Cameras',
    ...AUDIO_TYPES_REQUIRED_HEADERS,
    'HME Type',
    'HME Username',
    'HME Password',
    'Zoom IP',
    'Street',
    'City',
    'State Code',
    'Postal Code',
    'Country Code',
    'Site Open Date'
];

export default class OpportunitySiteTemplateUpload extends LightningElement {
    @api updatesJson;

    errorMessage;
    fileName;
    rowCount = 0;

    handleFileChange(event) {
        this.errorMessage = undefined;
        this.fileName = undefined;
        this.rowCount = 0;
        this.publishUpdates([]);

        const file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }

        this.fileName = file.name;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = reader.result;
                const parsedRows = this.parseCsv(text);
                this.rowCount = parsedRows.length;
                this.publishUpdates(parsedRows);
            } catch (error) {
                this.errorMessage = error.message || 'Unable to parse the uploaded CSV template.';
                this.publishUpdates([]);
                this.rowCount = 0;
            }
        };
        reader.onerror = () => {
            this.errorMessage = 'Unable to read the uploaded file.';
            this.publishUpdates([]);
        };
        reader.readAsText(file);
    }

    @api
    validate() {
        if (this.errorMessage) {
            return {
                isValid: false,
                errorMessage: this.errorMessage
            };
        }

        if (!this.rowCount) {
            return {
                isValid: false,
                errorMessage: 'Upload a completed CSV template before continuing.'
            };
        }

        return { isValid: true };
    }

    parseCsv(text) {
        const normalizedText = (text || '').replace(/^\uFEFF/, '').trim();
        if (!normalizedText) {
            throw new Error('The uploaded CSV file is empty.');
        }

        const lines = normalizedText.split(/\r?\n/).filter((line) => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error('The uploaded CSV file does not contain any data rows.');
        }

        const headers = this.parseCsvLine(lines[0]).map((header) => header.trim());
        for (const requiredHeader of REQUIRED_HEADERS.filter((header) => !AUDIO_TYPES_REQUIRED_HEADERS.includes(header))) {
            if (!headers.includes(requiredHeader)) {
                throw new Error(`The uploaded CSV file is missing the "${requiredHeader}" column.`);
            }
        }
        const audioTypesRequiredHeader = AUDIO_TYPES_REQUIRED_HEADERS.find((header) => headers.includes(header));
        if (!audioTypesRequiredHeader) {
            throw new Error(
                `The uploaded CSV file is missing one of these columns: ${AUDIO_TYPES_REQUIRED_HEADERS.join(', ')}.`
            );
        }

        const headerIndex = {};
        headers.forEach((header, index) => {
            headerIndex[header] = index;
        });

        return lines
            .slice(1)
            .map((line) => this.parseCsvLine(line))
            .filter((columns) => columns.some((value) => value.trim() !== ''))
            .map((columns) => ({
                opportunitySiteId: this.readColumn(columns, headerIndex, 'Opportunity Site Id'),
                totalCamera: this.parseNumber(this.readColumn(columns, headerIndex, 'Number of Cameras')),
                pointOfSaleSystem: this.readColumn(columns, headerIndex, 'Point of Sale System'),
                cameraMake: this.readColumn(columns, headerIndex, 'NVR DVR Make'),
                cameraModel: this.readColumn(columns, headerIndex, 'NVR DVR Model'),
                cameraMakeCustom: this.readColumn(columns, headerIndex, 'Camera Make'),
                cameraModelCustom: this.readColumn(columns, headerIndex, 'Camera Model'),
                dataIntegrationsRequiredOther: this.readColumn(columns, headerIndex, 'Data integrations required other'),
                shippingAddressStreet: this.readColumn(columns, headerIndex, 'Shipping Address Street'),
                shippingAddressCity: this.readColumn(columns, headerIndex, 'Shipping Address City'),
                shippingAddressStateCode: this.readColumn(columns, headerIndex, 'Shipping Address State Code'),
                shippingAddressPostalCode: this.readColumn(columns, headerIndex, 'Shipping Address Postal Code'),
                shippingAddressCountryCode: this.readColumn(columns, headerIndex, 'Shipping Address Country Code'),
                whoIsInstalling: this.readColumn(columns, headerIndex, 'Who is Installing'),
                additionalBillingNotes: this.readColumn(columns, headerIndex, 'Additional billing notes'),
                nvrDvrUsername: this.readColumn(columns, headerIndex, 'NVR DVR Username'),
                nvrDvrPassword: this.readColumn(columns, headerIndex, 'NVR DVR Password'),
                nvrDvrRecordInParallelWithSrd: this.parseBoolean(
                    this.readColumn(columns, headerIndex, 'NVR DVR Record In Parallel With SRD')
                ),
                nvrDvrRequiredAsPoe: this.parseBoolean(
                    this.readColumn(columns, headerIndex, 'NVR DVR Required as POE')
                ),
                permissionToResetNvrAndCameras: this.parseBoolean(
                    this.readColumn(columns, headerIndex, 'Permission to Reset NVR and Cameras')
                ),
                audioTypesRequired: this.readColumn(columns, headerIndex, audioTypesRequiredHeader),
                hmeType: this.readColumn(columns, headerIndex, 'HME Type'),
                hmeUsername: this.readColumn(columns, headerIndex, 'HME Username'),
                hmePassword: this.readColumn(columns, headerIndex, 'HME Password'),
                zoomIp: this.readColumn(columns, headerIndex, 'Zoom IP'),
                siteAddressStreet: this.readColumn(columns, headerIndex, 'Street'),
                siteAddressCity: this.readColumn(columns, headerIndex, 'City'),
                siteAddressStateCode: this.readColumn(columns, headerIndex, 'State Code'),
                siteAddressPostalCode: this.readColumn(columns, headerIndex, 'Postal Code'),
                siteAddressCountryCode: this.readColumn(columns, headerIndex, 'Country Code'),
                siteOpenDate: this.parseDate(this.readColumn(columns, headerIndex, 'Site Open Date'))
            }))
            .filter((row) => row.opportunitySiteId);
    }

    parseCsvLine(line) {
        const values = [];
        let currentValue = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i += 1) {
            const character = line[i];

            if (character === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    currentValue += '"';
                    i += 1;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (character === ',' && !inQuotes) {
                values.push(currentValue);
                currentValue = '';
            } else {
                currentValue += character;
            }
        }

        values.push(currentValue);
        return values;
    }

    readColumn(columns, headerIndex, headerName) {
        const index = headerIndex[headerName];
        return index === undefined || columns[index] === undefined ? '' : columns[index].trim();
    }

    parseNumber(rawValue) {
        if (!rawValue) {
            return null;
        }

        const parsedValue = Number(rawValue);
        if (Number.isNaN(parsedValue)) {
            throw new Error(`Invalid number value "${rawValue}" in Number of Cameras.`);
        }

        return parsedValue;
    }

    parseBoolean(rawValue) {
        const normalizedValue = (rawValue || '').trim().toLowerCase();
        if (!normalizedValue) {
            return false;
        }
        if (['true', 'yes', 'y', '1'].includes(normalizedValue)) {
            return true;
        }
        if (['false', 'no', 'n', '0'].includes(normalizedValue)) {
            return false;
        }

        throw new Error(`Invalid checkbox value "${rawValue}". Use TRUE or FALSE.`);
    }

    parseDate(rawValue) {
        if (!rawValue) {
            return null;
        }

        const normalizedValue = rawValue.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
            throw new Error(`Invalid date value "${rawValue}" in Site Open Date. Use YYYY-MM-DD.`);
        }

        return normalizedValue;
    }

    publishUpdates(rows) {
        this.updatesJson = JSON.stringify(rows);
        this.dispatchEvent(new FlowAttributeChangeEvent('updatesJson', this.updatesJson));
    }
}