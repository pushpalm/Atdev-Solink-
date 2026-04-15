import { api, LightningElement } from 'lwc';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';
import manualDataEntryRecommendation from '@salesforce/label/c.ManualDataEntryRecommendation';

export default class CameraDataModeSelector extends LightningElement {
    @api selectedMode;
    labels = {
        manualDataEntryRecommendation
    };

    handleChange(event) {
        this.selectedMode = event.target.value;
        this.dispatchEvent(new FlowAttributeChangeEvent('selectedMode', this.selectedMode));
    }

    get isManualSelected() {
        return this.selectedMode === 'manual';
    }

    get isDownloadSelected() {
        return this.selectedMode === 'download';
    }

    get isUploadSelected() {
        return this.selectedMode === 'upload';
    }

    get manualOptionClass() {
        return `selector__option${this.isManualSelected ? ' selector__option--selected' : ''}`;
    }

    get downloadOptionClass() {
        return `selector__option${this.isDownloadSelected ? ' selector__option--selected' : ''}`;
    }

    get uploadOptionClass() {
        return `selector__option${this.isUploadSelected ? ' selector__option--selected' : ''}`;
    }

    @api
    validate() {
        if (this.selectedMode) {
            return { isValid: true };
        }

        return {
            isValid: false,
            errorMessage: 'Choose whether to enter data manually, download the template, or upload completed site data.'
        };
    }
}