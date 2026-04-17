/**
 * Supplies a flattened view of Opportunity Site and related Site camera data for UI consumers.
 *
 * Used by:
 * - `opportunitySiteCameraTable` to display and edit camera details in the manual-entry path.
 * - `opportunitySiteTemplateDownload` to fetch the same dataset for the template download flow.
 *
 * Created: 2026-03-31
 * Created for: BR2.1 use case to support the "Manage Opportunity Site Camera Data" experience.
 */
public with sharing class OpportunitySiteCameraDataController {
    @AuraEnabled
    public static Integer applyOpportunityContactDefaults(Id opportunityId) {
        if (opportunityId == null) {
            return 0;
        }

        Map<Id, Site__c> pendingSiteUpdates = new Map<Id, Site__c>();
        for (Opportunity_Site__c opportunitySite : [
            SELECT
                Site__c,
                Site__r.Shipping_Contact__c,
                Site__r.Install_Contact__c,
                Site__r.Data_Contact__c,
                Site__r.Billing_Contact__c,
                Site__r.Account_Administrator__c,
                Opportunity__r.Onsite_Contact_Name__c,
                Opportunity__r.Install_Contact__c,
                Opportunity__r.Data_Contact__c,
                Opportunity__r.Billing_Contact__c,
                Opportunity__r.Account_Administrator__c
            FROM Opportunity_Site__c
            WHERE Opportunity__c = :opportunityId
        ]) {
            if (opportunitySite.Site__c == null || opportunitySite.Site__r == null || opportunitySite.Opportunity__r == null) {
                continue;
            }

            Site__c siteToUpdate = new Site__c(Id = opportunitySite.Site__c);
            Boolean hasChanges = false;

            if (opportunitySite.Site__r.Shipping_Contact__c == null && opportunitySite.Opportunity__r.Onsite_Contact_Name__c != null) {
                siteToUpdate.Shipping_Contact__c = opportunitySite.Opportunity__r.Onsite_Contact_Name__c;
                hasChanges = true;
            }
            if (opportunitySite.Site__r.Install_Contact__c == null && opportunitySite.Opportunity__r.Install_Contact__c != null) {
                siteToUpdate.Install_Contact__c = opportunitySite.Opportunity__r.Install_Contact__c;
                hasChanges = true;
            }
            if (opportunitySite.Site__r.Data_Contact__c == null && opportunitySite.Opportunity__r.Data_Contact__c != null) {
                siteToUpdate.Data_Contact__c = opportunitySite.Opportunity__r.Data_Contact__c;
                hasChanges = true;
            }
            if (opportunitySite.Site__r.Billing_Contact__c == null && opportunitySite.Opportunity__r.Billing_Contact__c != null) {
                siteToUpdate.Billing_Contact__c = opportunitySite.Opportunity__r.Billing_Contact__c;
                hasChanges = true;
            }
            if (
                opportunitySite.Site__r.Account_Administrator__c == null &&
                opportunitySite.Opportunity__r.Account_Administrator__c != null
            ) {
                siteToUpdate.Account_Administrator__c = opportunitySite.Opportunity__r.Account_Administrator__c;
                hasChanges = true;
            }

            if (hasChanges) {
                pendingSiteUpdates.put(siteToUpdate.Id, siteToUpdate);
            }
        }

        if (pendingSiteUpdates.isEmpty()) {
            return 0;
        }

        update pendingSiteUpdates.values();
        return pendingSiteUpdates.size();
    }

    @AuraEnabled(cacheable=true)
    public static List<ContactOption> getOpportunityAccountContacts(Id opportunityId) {
        List<ContactOption> options = new List<ContactOption>();
        if (opportunityId == null) {
            return options;
        }

        Opportunity targetOpportunity = [
            SELECT AccountId
            FROM Opportunity
            WHERE Id = :opportunityId
            LIMIT 1
        ];
        if (targetOpportunity.AccountId == null) {
            return options;
        }

        for (Contact recordContact : [
            SELECT Id, Name, Email
            FROM Contact
            WHERE AccountId = :targetOpportunity.AccountId
            ORDER BY Name ASC
        ]) {
            ContactOption option = new ContactOption();
            option.value = recordContact.Id;
            option.label = String.isBlank(recordContact.Email)
                ? recordContact.Name
                : recordContact.Name + ' (' + recordContact.Email + ')';
            options.add(option);
        }
        return options;
    }

    @AuraEnabled
    public static ContactOption createContactForOpportunity(
        Id opportunityId,
        String firstName,
        String lastName,
        String email,
        String phone
    ) {
        if (
            opportunityId == null ||
            String.isBlank(firstName) ||
            String.isBlank(lastName) ||
            String.isBlank(email) ||
            String.isBlank(phone)
        ) {
            throw new AuraHandledException('First Name, Last Name, Email, and Phone are required to create a contact.');
        }

        // Delegate the insert to a without-sharing helper so external users
        // can create contacts tied to the opportunity account.
        return new ContactCreationSystemService().createContactForOpportunity(
            opportunityId,
            firstName,
            lastName,
            email,
            phone
        );
    }

    @AuraEnabled(cacheable=true)
    public static FieldConfig getEditableFieldConfig() {
        FieldConfig config = new FieldConfig();
        config.pointOfSaleSystemOptions = getPicklistOptions('Point_of_Sale_System__c');
        config.whoIsInstallingOptions = getPicklistOptions('Who_is_Installing__c');
        config.siteAddressStateCodeOptions = getPicklistOptions('Site_Address__StateCode__s');
        config.siteAddressCountryCodeOptions = getPicklistOptions('Site_Address__CountryCode__s');
        config.audioTypesRequiredLabel = getFieldLabel('Opportunity_Site__c', 'Audio_Type_s_Required__c');
        config.audioTypesRequiredOptions = getPicklistOptions('Audio_Type_s_Required__c', 'Opportunity_Site__c');
        config.fieldLabels = new FieldLabels();
        config.fieldLabels.siteAddressStreet = getFieldLabel('Site__c', 'Site_Address__Street__s');
        config.fieldLabels.siteAddressCity = getFieldLabel('Site__c', 'Site_Address__City__s');
        config.fieldLabels.siteAddressStateCode = getFieldLabel('Site__c', 'Site_Address__StateCode__s');
        config.fieldLabels.siteAddressPostalCode = getFieldLabel('Site__c', 'Site_Address__PostalCode__s');
        config.fieldLabels.siteAddressCountryCode = getFieldLabel('Site__c', 'Site_Address__CountryCode__s');
        config.fieldLabels.totalCamera = getFieldLabel('Site__c', 'Number_of_Cameras__c');
        config.fieldLabels.pointOfSaleSystem = getFieldLabel('Site__c', 'Point_of_Sale_System__c');
        config.fieldLabels.siteOpenDate = getFieldLabel('Site__c', 'Site_Open_Date__c');
        config.fieldLabels.nvrDvrRequiredAsPoe = getFieldLabel('Site__c', 'NVR_DVR_Required_as_POE__c');
        config.fieldLabels.nvrDvrRecordInParallelWithSrd = getFieldLabel('Site__c', 'NVR_DVR_Record_In_Parallel_With_SRD__c');
        config.fieldLabels.permissionToResetNvrAndCameras = getFieldLabel('Site__c', 'Permission_to_Reset_NVR_and_Cameras__c');
        config.fieldLabels.cameraMake = getFieldLabel('Site__c', 'NVR_DVR_Make__c');
        config.fieldLabels.cameraModel = getFieldLabel('Site__c', 'NVR_DVR_Model__c');
        config.fieldLabels.cameraMakeCustom = getFieldLabel('Site__c', 'Camera_Make__c');
        config.fieldLabels.cameraModelCustom = getFieldLabel('Site__c', 'Camera_Model__c');
        config.fieldLabels.dataIntegrationsRequiredOther = getFieldLabel('Site__c', 'Data_integrations_required_other__c');
        config.fieldLabels.shippingAddressStreet = getFieldLabel('Site__c', 'Shipping_Address__Street__s');
        config.fieldLabels.shippingAddressCity = getFieldLabel('Site__c', 'Shipping_Address__City__s');
        config.fieldLabels.shippingAddressStateCode = getFieldLabel('Site__c', 'Shipping_Address__StateCode__s');
        config.fieldLabels.shippingAddressPostalCode = getFieldLabel('Site__c', 'Shipping_Address__PostalCode__s');
        config.fieldLabels.shippingAddressCountryCode = getFieldLabel('Site__c', 'Shipping_Address__CountryCode__s');
        config.fieldLabels.whoIsInstalling = getFieldLabel('Site__c', 'Who_is_Installing__c');
        config.fieldLabels.additionalBillingNotes = getFieldLabel('Site__c', 'Additional_billing_notes__c');
        config.fieldLabels.nvrDvrUsername = getFieldLabel('Site__c', 'NVR_DVR_Username__c');
        config.fieldLabels.nvrDvrPassword = getFieldLabel('Site__c', 'NVR_DVR_Password__c');
        config.fieldLabels.hmeType = getFieldLabel('Site__c', 'HME_Type__c');
        config.fieldLabels.hmeUsername = getFieldLabel('Site__c', 'HME_Username__c');
        config.fieldLabels.hmePassword = getFieldLabel('Site__c', 'HME_Password__c');
        config.fieldLabels.headsetAudioType = getFieldLabel('Site__c', 'Headset_Audio_Type__c');
        config.fieldLabels.zoomIp = getFieldLabel('Site__c', 'Zoom_IP__c');
        return config;
    }

    @AuraEnabled(cacheable=true)
    public static List<OpportunitySiteCameraRow> getOpportunitySiteCameraRows(Id opportunityId) {
        List<OpportunitySiteCameraRow> rows = new List<OpportunitySiteCameraRow>();

        if (opportunityId == null) {
            return rows;
        }

        // Query the junction records and the related Site fields the UI needs to display/edit.
        for (Opportunity_Site__c opportunitySite : [
            SELECT
                Id,
                Opportunity__c,
                Opportunity__r.AccountId,
                Opportunity__r.Account.Name,
                Site__c,
                Site__r.Name,
                Site__r.Number_of_Cameras__c,
                Site__r.Point_of_Sale_System__c,
                Site__r.NVR_DVR_Make__c,
                Site__r.NVR_DVR_Model__c,
                Site__r.Camera_Make__c,
                Site__r.Camera_Model__c,
                Site__r.Data_integrations_required_other__c,
                Site__r.Shipping_Address__Street__s,
                Site__r.Shipping_Address__City__s,
                Site__r.Shipping_Address__StateCode__s,
                Site__r.Shipping_Address__PostalCode__s,
                Site__r.Shipping_Address__CountryCode__s,
                Site__r.Who_is_Installing__c,
                Site__r.Additional_billing_notes__c,
                Site__r.NVR_DVR_Username__c,
                Site__r.NVR_DVR_Password__c,
                Site__r.NVR_DVR_Record_In_Parallel_With_SRD__c,
                Site__r.NVR_DVR_Required_as_POE__c,
                Site__r.Permission_to_Reset_NVR_and_Cameras__c,
                Site__r.Headset_Audio_Type__c,
                Site__r.HME_Type__c,
                Site__r.HME_Username__c,
                Site__r.HME_Password__c,
                Site__r.Zoom_IP__c,
                Site__r.Site_Address__Street__s,
                Site__r.Site_Address__City__s,
                Site__r.Site_Address__StateCode__s,
                Site__r.Site_Address__PostalCode__s,
                Site__r.Site_Address__CountryCode__s,
                Site__r.Site_Open_Date__c,
                Site__r.Shipping_Contact__c,
                Site__r.Shipping_Contact__r.Name,
                Site__r.Install_Contact__c,
                Site__r.Install_Contact__r.Name,
                Site__r.Data_Contact__c,
                Site__r.Data_Contact__r.Name,
                Site__r.Billing_Contact__c,
                Site__r.Billing_Contact__r.Name,
                Site__r.Account_Administrator__c,
                Site__r.Account_Administrator__r.Name,
                Opportunity__r.Onsite_Contact_Name__c,
                Opportunity__r.Onsite_Contact_Name__r.Name,
                Opportunity__r.Install_Contact__c,
                Opportunity__r.Install_Contact__r.Name,
                Opportunity__r.Data_Contact__c,
                Opportunity__r.Data_Contact__r.Name,
                Opportunity__r.Billing_Contact__c,
                Opportunity__r.Billing_Contact__r.Name,
                Opportunity__r.Account_Administrator__c,
                Opportunity__r.Account_Administrator__r.Name,
                Audio_Type_s_Required__c
            FROM Opportunity_Site__c
            WHERE Opportunity__c = :opportunityId
            ORDER BY Site__r.Name ASC
        ]) {
            OpportunitySiteCameraRow row = new OpportunitySiteCameraRow();
            row.opportunitySiteId = opportunitySite.Id;
            row.opportunityId = opportunitySite.Opportunity__c;
            row.accountId = opportunitySite.Opportunity__r != null ? opportunitySite.Opportunity__r.AccountId : null;
            row.siteId = opportunitySite.Site__c;

            // Related records may be missing in edge cases, so populate the response defensively.
            row.accountName = opportunitySite.Opportunity__r != null && opportunitySite.Opportunity__r.Account != null
                ? opportunitySite.Opportunity__r.Account.Name
                : null;
            row.siteName = opportunitySite.Site__r != null ? opportunitySite.Site__r.Name : null;
            row.totalCamera = opportunitySite.Site__r != null ? opportunitySite.Site__r.Number_of_Cameras__c : null;
            row.pointOfSaleSystem = opportunitySite.Site__r != null ? opportunitySite.Site__r.Point_of_Sale_System__c : null;
            row.cameraMake = opportunitySite.Site__r != null ? opportunitySite.Site__r.NVR_DVR_Make__c : null;
            row.cameraModel = opportunitySite.Site__r != null ? opportunitySite.Site__r.NVR_DVR_Model__c : null;
            row.cameraMakeCustom = opportunitySite.Site__r != null ? opportunitySite.Site__r.Camera_Make__c : null;
            row.cameraModelCustom = opportunitySite.Site__r != null ? opportunitySite.Site__r.Camera_Model__c : null;
            row.dataIntegrationsRequiredOther =
                opportunitySite.Site__r != null ? opportunitySite.Site__r.Data_integrations_required_other__c : null;
            row.shippingAddressStreet = opportunitySite.Site__r != null ? opportunitySite.Site__r.Shipping_Address__Street__s : null;
            row.shippingAddressCity = opportunitySite.Site__r != null ? opportunitySite.Site__r.Shipping_Address__City__s : null;
            row.shippingAddressStateCode =
                opportunitySite.Site__r != null ? opportunitySite.Site__r.Shipping_Address__StateCode__s : null;
            row.shippingAddressPostalCode =
                opportunitySite.Site__r != null ? opportunitySite.Site__r.Shipping_Address__PostalCode__s : null;
            row.shippingAddressCountryCode =
                opportunitySite.Site__r != null ? opportunitySite.Site__r.Shipping_Address__CountryCode__s : null;
            row.whoIsInstalling = opportunitySite.Site__r != null ? opportunitySite.Site__r.Who_is_Installing__c : null;
            row.additionalBillingNotes =
                opportunitySite.Site__r != null ? opportunitySite.Site__r.Additional_billing_notes__c : null;
            row.nvrDvrUsername = opportunitySite.Site__r != null ? opportunitySite.Site__r.NVR_DVR_Username__c : null;
            row.nvrDvrPassword = opportunitySite.Site__r != null ? opportunitySite.Site__r.NVR_DVR_Password__c : null;
            row.nvrDvrRecordInParallelWithSrd =
                opportunitySite.Site__r != null ? opportunitySite.Site__r.NVR_DVR_Record_In_Parallel_With_SRD__c : null;
            row.nvrDvrRequiredAsPoe =
                opportunitySite.Site__r != null ? opportunitySite.Site__r.NVR_DVR_Required_as_POE__c : null;
            row.permissionToResetNvrAndCameras =
                opportunitySite.Site__r != null ? opportunitySite.Site__r.Permission_to_Reset_NVR_and_Cameras__c : null;
            row.headsetAudioType = opportunitySite.Site__r != null ? opportunitySite.Site__r.Headset_Audio_Type__c : null;
            row.hmeType = opportunitySite.Site__r != null ? opportunitySite.Site__r.HME_Type__c : null;
            row.hmeUsername = opportunitySite.Site__r != null ? opportunitySite.Site__r.HME_Username__c : null;
            row.hmePassword = opportunitySite.Site__r != null ? opportunitySite.Site__r.HME_Password__c : null;
            row.zoomIp = opportunitySite.Site__r != null ? opportunitySite.Site__r.Zoom_IP__c : null;
            row.siteAddressStreet = opportunitySite.Site__r != null ? opportunitySite.Site__r.Site_Address__Street__s : null;
            row.siteAddressCity = opportunitySite.Site__r != null ? opportunitySite.Site__r.Site_Address__City__s : null;
            row.siteAddressStateCode = opportunitySite.Site__r != null ? opportunitySite.Site__r.Site_Address__StateCode__s : null;
            row.siteAddressPostalCode = opportunitySite.Site__r != null ? opportunitySite.Site__r.Site_Address__PostalCode__s : null;
            row.siteAddressCountryCode = opportunitySite.Site__r != null ? opportunitySite.Site__r.Site_Address__CountryCode__s : null;
            row.siteOpenDate = opportunitySite.Site__r != null ? opportunitySite.Site__r.Site_Open_Date__c : null;
            row.shippingContactId =
                opportunitySite.Site__r != null && opportunitySite.Site__r.Shipping_Contact__c != null
                    ? opportunitySite.Site__r.Shipping_Contact__c
                    : (opportunitySite.Opportunity__r != null ? opportunitySite.Opportunity__r.Onsite_Contact_Name__c : null);
            row.shippingContactName =
                opportunitySite.Site__r != null && opportunitySite.Site__r.Shipping_Contact__r != null
                    ? opportunitySite.Site__r.Shipping_Contact__r.Name
                    : (opportunitySite.Opportunity__r != null && opportunitySite.Opportunity__r.Onsite_Contact_Name__r != null
                        ? opportunitySite.Opportunity__r.Onsite_Contact_Name__r.Name
                        : null);
            row.installContactId =
                opportunitySite.Site__r != null && opportunitySite.Site__r.Install_Contact__c != null
                    ? opportunitySite.Site__r.Install_Contact__c
                    : (opportunitySite.Opportunity__r != null ? opportunitySite.Opportunity__r.Install_Contact__c : null);
            row.installContactName =
                opportunitySite.Site__r != null && opportunitySite.Site__r.Install_Contact__r != null
                    ? opportunitySite.Site__r.Install_Contact__r.Name
                    : (opportunitySite.Opportunity__r != null && opportunitySite.Opportunity__r.Install_Contact__r != null
                        ? opportunitySite.Opportunity__r.Install_Contact__r.Name
                        : null);
            row.dataContactId =
                opportunitySite.Site__r != null && opportunitySite.Site__r.Data_Contact__c != null
                    ? opportunitySite.Site__r.Data_Contact__c
                    : (opportunitySite.Opportunity__r != null ? opportunitySite.Opportunity__r.Data_Contact__c : null);
            row.dataContactName =
                opportunitySite.Site__r != null && opportunitySite.Site__r.Data_Contact__r != null
                    ? opportunitySite.Site__r.Data_Contact__r.Name
                    : (opportunitySite.Opportunity__r != null && opportunitySite.Opportunity__r.Data_Contact__r != null
                        ? opportunitySite.Opportunity__r.Data_Contact__r.Name
                        : null);
            row.billingContactId =
                opportunitySite.Site__r != null && opportunitySite.Site__r.Billing_Contact__c != null
                    ? opportunitySite.Site__r.Billing_Contact__c
                    : (opportunitySite.Opportunity__r != null ? opportunitySite.Opportunity__r.Billing_Contact__c : null);
            row.billingContactName =
                opportunitySite.Site__r != null && opportunitySite.Site__r.Billing_Contact__r != null
                    ? opportunitySite.Site__r.Billing_Contact__r.Name
                    : (opportunitySite.Opportunity__r != null && opportunitySite.Opportunity__r.Billing_Contact__r != null
                        ? opportunitySite.Opportunity__r.Billing_Contact__r.Name
                        : null);
            row.accountAdministratorContactId =
                opportunitySite.Site__r != null && opportunitySite.Site__r.Account_Administrator__c != null
                    ? opportunitySite.Site__r.Account_Administrator__c
                    : (opportunitySite.Opportunity__r != null ? opportunitySite.Opportunity__r.Account_Administrator__c : null);
            row.accountAdministratorContactName =
                opportunitySite.Site__r != null && opportunitySite.Site__r.Account_Administrator__r != null
                    ? opportunitySite.Site__r.Account_Administrator__r.Name
                    : (opportunitySite.Opportunity__r != null && opportunitySite.Opportunity__r.Account_Administrator__r != null
                        ? opportunitySite.Opportunity__r.Account_Administrator__r.Name
                        : null);
            row.audioTypesRequired = opportunitySite.Audio_Type_s_Required__c;
            row.siteAddress = formatAddress(
                row.siteAddressStreet,
                row.siteAddressCity,
                row.siteAddressStateCode,
                row.siteAddressPostalCode,
                row.siteAddressCountryCode
            );
            rows.add(row);
        }

        return rows;
    }

    private static List<PicklistOption> getPicklistOptions(String fieldApiName) {
        return getPicklistOptions(fieldApiName, 'Site__c');
    }

    private static List<PicklistOption> getPicklistOptions(String fieldApiName, String objectApiName) {
        List<PicklistOption> options = new List<PicklistOption>();
        Schema.SObjectType targetObjectType = Schema.getGlobalDescribe().get(objectApiName);
        if (targetObjectType == null) {
            return options;
        }

        Schema.SObjectField fieldToken = targetObjectType.getDescribe().fields.getMap().get(fieldApiName);

        if (fieldToken == null) {
            return options;
        }

        Schema.DescribeFieldResult fieldDescribe = fieldToken.getDescribe();
        if (fieldDescribe.getType() != Schema.DisplayType.Picklist) {
            return options;
        }

        for (Schema.PicklistEntry entry : fieldDescribe.getPicklistValues()) {
            if (!entry.isActive()) {
                continue;
            }

            PicklistOption option = new PicklistOption();
            option.label = entry.getLabel();
            option.value = entry.getValue();
            options.add(option);
        }

        return options;
    }

    private static String getFieldLabel(String objectApiName, String fieldApiName) {
        Schema.SObjectType targetObjectType = Schema.getGlobalDescribe().get(objectApiName);
        if (targetObjectType == null) {
            return fieldApiName;
        }

        Schema.SObjectField fieldToken = targetObjectType.getDescribe().fields.getMap().get(fieldApiName);
        if (fieldToken == null) {
            return fieldApiName;
        }

        return fieldToken.getDescribe().getLabel();
    }

    private static String formatAddress(
        String street,
        String city,
        String stateCode,
        String postalCode,
        String countryCode
    ) {
        List<String> parts = new List<String>();

        if (String.isNotBlank(street)) {
            parts.add(street);
        }

        String cityStatePostal = '';
        if (String.isNotBlank(city)) {
            cityStatePostal += city;
        }
        if (String.isNotBlank(stateCode)) {
            cityStatePostal += (cityStatePostal == '' ? '' : ', ') + stateCode;
        }
        if (String.isNotBlank(postalCode)) {
            cityStatePostal += (cityStatePostal == '' ? '' : ' ') + postalCode;
        }
        if (String.isNotBlank(cityStatePostal)) {
            parts.add(cityStatePostal);
        }

        if (String.isNotBlank(countryCode)) {
            parts.add(countryCode);
        }

        return parts.isEmpty() ? null : String.join(parts, ', ');
    }
    // Added on April 17th Pushpi Mandal
    // Runs in system context so portal users can create the contact
    // as long as the target opportunity/account is valid.
    private without sharing class ContactCreationSystemService {
        private ContactOption createContactForOpportunity(
            Id opportunityId,
            String firstName,
            String lastName,
            String email,
            String phone
        ) {
            Opportunity targetOpportunity = [
                SELECT AccountId
                FROM Opportunity
                WHERE Id = :opportunityId
                LIMIT 1
            ];
            if (targetOpportunity.AccountId == null) {
                throw new AuraHandledException('The selected opportunity must have an account before creating contacts.');
            }

            Contact newContact = new Contact(
                FirstName = firstName.trim(),
                LastName = lastName.trim(),
                Email = email.trim(),
                Phone = phone.trim(),
                AccountId = targetOpportunity.AccountId
            );
            // Do not set OwnerId explicitly. Let Salesforce assign ownership to
            // avoid portal-user cross-reference ownership errors.
            insert newContact;

            ContactOption option = new ContactOption();
            option.value = newContact.Id;
            option.label = String.isBlank(newContact.Email)
                ? newContact.Name
                : newContact.Name + ' (' + newContact.Email + ')';
            return option;
        }
    }

    // Lightweight DTO returned to the client so the UI does not need to traverse nested sObjects.
    public class OpportunitySiteCameraRow {
        @AuraEnabled public Id opportunitySiteId;
        @AuraEnabled public Id opportunityId;
        @AuraEnabled public Id accountId;
        @AuraEnabled public Id siteId;
        @AuraEnabled public String accountName;
        @AuraEnabled public String siteName;
        @AuraEnabled public Decimal totalCamera;
        @AuraEnabled public String pointOfSaleSystem;
        @AuraEnabled public String cameraMake;
        @AuraEnabled public String cameraModel;
        @AuraEnabled public String cameraMakeCustom;
        @AuraEnabled public String cameraModelCustom;
        @AuraEnabled public String dataIntegrationsRequiredOther;
        @AuraEnabled public String shippingAddressStreet;
        @AuraEnabled public String shippingAddressCity;
        @AuraEnabled public String shippingAddressStateCode;
        @AuraEnabled public String shippingAddressPostalCode;
        @AuraEnabled public String shippingAddressCountryCode;
        @AuraEnabled public String whoIsInstalling;
        @AuraEnabled public String additionalBillingNotes;
        @AuraEnabled public String nvrDvrUsername;
        @AuraEnabled public String nvrDvrPassword;
        @AuraEnabled public Boolean nvrDvrRecordInParallelWithSrd;
        @AuraEnabled public Boolean nvrDvrRequiredAsPoe;
        @AuraEnabled public Boolean permissionToResetNvrAndCameras;
        @AuraEnabled public String headsetAudioType;
        @AuraEnabled public String hmeType;
        @AuraEnabled public String hmeUsername;
        @AuraEnabled public String hmePassword;
        @AuraEnabled public String zoomIp;
        @AuraEnabled public String siteAddress;
        @AuraEnabled public String siteAddressStreet;
        @AuraEnabled public String siteAddressCity;
        @AuraEnabled public String siteAddressStateCode;
        @AuraEnabled public String siteAddressPostalCode;
        @AuraEnabled public String siteAddressCountryCode;
        @AuraEnabled public Date siteOpenDate;
        @AuraEnabled public String audioTypesRequired;
        @AuraEnabled public Id shippingContactId;
        @AuraEnabled public String shippingContactName;
        @AuraEnabled public Id installContactId;
        @AuraEnabled public String installContactName;
        @AuraEnabled public Id dataContactId;
        @AuraEnabled public String dataContactName;
        @AuraEnabled public Id billingContactId;
        @AuraEnabled public String billingContactName;
        @AuraEnabled public Id accountAdministratorContactId;
        @AuraEnabled public String accountAdministratorContactName;
    }

    public class FieldConfig {
        @AuraEnabled public List<PicklistOption> pointOfSaleSystemOptions = new List<PicklistOption>();
        @AuraEnabled public List<PicklistOption> whoIsInstallingOptions = new List<PicklistOption>();
        @AuraEnabled public List<PicklistOption> siteAddressStateCodeOptions = new List<PicklistOption>();
        @AuraEnabled public List<PicklistOption> siteAddressCountryCodeOptions = new List<PicklistOption>();
        @AuraEnabled public String audioTypesRequiredLabel;
        @AuraEnabled public List<PicklistOption> audioTypesRequiredOptions = new List<PicklistOption>();
        @AuraEnabled public FieldLabels fieldLabels;
    }

    public class FieldLabels {
        @AuraEnabled public String siteAddressStreet;
        @AuraEnabled public String siteAddressCity;
        @AuraEnabled public String siteAddressStateCode;
        @AuraEnabled public String siteAddressPostalCode;
        @AuraEnabled public String siteAddressCountryCode;
        @AuraEnabled public String totalCamera;
        @AuraEnabled public String pointOfSaleSystem;
        @AuraEnabled public String siteOpenDate;
        @AuraEnabled public String nvrDvrRequiredAsPoe;
        @AuraEnabled public String nvrDvrRecordInParallelWithSrd;
        @AuraEnabled public String permissionToResetNvrAndCameras;
        @AuraEnabled public String cameraMake;
        @AuraEnabled public String cameraModel;
        @AuraEnabled public String cameraMakeCustom;
        @AuraEnabled public String cameraModelCustom;
        @AuraEnabled public String dataIntegrationsRequiredOther;
        @AuraEnabled public String shippingAddressStreet;
        @AuraEnabled public String shippingAddressCity;
        @AuraEnabled public String shippingAddressStateCode;
        @AuraEnabled public String shippingAddressPostalCode;
        @AuraEnabled public String shippingAddressCountryCode;
        @AuraEnabled public String whoIsInstalling;
        @AuraEnabled public String additionalBillingNotes;
        @AuraEnabled public String nvrDvrUsername;
        @AuraEnabled public String nvrDvrPassword;
        @AuraEnabled public String hmeType;
        @AuraEnabled public String hmeUsername;
        @AuraEnabled public String hmePassword;
        @AuraEnabled public String headsetAudioType;
        @AuraEnabled public String zoomIp;
    }

    public class PicklistOption {
        @AuraEnabled public String label;
        @AuraEnabled public String value;
    }

    public class ContactOption {
        @AuraEnabled public String label;
        @AuraEnabled public Id value;
    }
}