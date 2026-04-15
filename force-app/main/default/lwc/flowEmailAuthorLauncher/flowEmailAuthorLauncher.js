import { api, LightningElement } from 'lwc';

export default class FlowEmailAuthorLauncher extends LightningElement {
    @api targetUrl;

    hasRedirected = false;

    renderedCallback() {
        if (this.hasRedirected || !this.targetUrl) {
            return;
        }

        this.hasRedirected = true;
        window.location.assign(this.targetUrl);
    }
}