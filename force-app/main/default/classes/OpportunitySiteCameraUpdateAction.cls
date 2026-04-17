/**
 * Invocable Apex action used by the `Manage_Opportunity_Site_Camera_Data` Flow.
 *
 * Usage:
 * - Called from the flow's manual-entry and template-upload paths to persist
 *   camera-related updates for `Site__c` records tied to a selected Opportunity.
 *
 * Created for:
 * - BR2.1 use case for Opportunity Site camera data maintenance.
 *
 * Source file date:
 * - Mar 31, 2026 (best available local file timestamp).
 */
public with sharing class OpportunitySiteCameraUpdateAction {

    @InvocableMethod(label='Update Opportunity Site Camera Data')
    public static List<Result> updateCameraData(List<Request> requests) {
        List<Result> results = new List<Result>();

        for (Request request : requests) {
            results.add(processRequest(request));
        }

        return results;
    }

    private static Result processRequest(Request request) {
        Result result = new Result();
        result.updatedCount = 0;

        if (request == null || request.opportunityId == null || String.isBlank(request.updatesJson)) {
            return result;
        }

        // Build the list of sites that the submitted request is allowed to update
        // based on the Opportunity_Site__c records for the current Opportunity.
        Set<Id> allowedSiteIds = new Set<Id>();
        Map<Id, Id> siteIdByOpportunitySiteId = new Map<Id, Id>();
        for (Opportunity_Site__c opportunitySite : [
            SELECT Id, Site__c
            FROM Opportunity_Site__c
            WHERE Opportunity__c = :request.opportunityId
        ]) {
            if (opportunitySite.Site__c != null) {
                allowedSiteIds.add(opportunitySite.Site__c);
                siteIdByOpportunitySiteId.put(opportunitySite.Id, opportunitySite.Site__c);
            }
        }

        // Deserialize untyped so blank strings in typed fields (Date/Decimal/Id)
        // can be normalized to null instead of throwing JSON parse errors.
        List<Object> requestedUpdates = (List<Object>) JSON.deserializeUntyped(request.updatesJson);

        List<Site__c> sitesToUpdate = new List<Site__c>();
        List<Opportunity_Site__c> opportunitySitesToUpdate = new List<Opportunity_Site__c>();
        for (Object rowObject : requestedUpdates) {
            if (!(rowObject instanceof Map<String, Object>)) {
                continue;
            }
            Map<String, Object> updateRow = (Map<String, Object>) rowObject;

            Id opportunitySiteId = toId(updateRow.get('opportunitySiteId'));
            Id resolvedSiteId = toId(updateRow.get('siteId'));
            if (resolvedSiteId == null && opportunitySiteId != null) {
                resolvedSiteId = siteIdByOpportunitySiteId.get(opportunitySiteId);
            }

            if (resolvedSiteId == null) {
                continue;
            }

            // Reject any record that does not belong to the current opportunity so
            // the flow cannot be used to update unrelated sites.
            if (!allowedSiteIds.contains(resolvedSiteId)) {
                throw new AuraHandledException('One or more submitted sites are not related to this opportunity.');
            }

            Site__c siteRecord = new Site__c(Id = resolvedSiteId);
            
            if (updateRow.containsKey('totalCamera')) {
                siteRecord.Number_of_Cameras__c = toDecimal(updateRow.get('totalCamera'));
            }
            if (updateRow.containsKey('pointOfSaleSystem')) {
                siteRecord.Point_of_Sale_System__c = toStringValue(updateRow.get('pointOfSaleSystem'));
            }
            if (updateRow.containsKey('cameraMake')) {
                siteRecord.NVR_DVR_Make__c = toStringValue(updateRow.get('cameraMake'));
            }
            if (updateRow.containsKey('cameraModel')) {
                siteRecord.NVR_DVR_Model__c = toStringValue(updateRow.get('cameraModel'));
            }
            if (updateRow.containsKey('cameraMakeCustom')) {
                siteRecord.Camera_Make__c = toStringValue(updateRow.get('cameraMakeCustom'));
            }
            if (updateRow.containsKey('cameraModelCustom')) {
                siteRecord.Camera_Model__c = toStringValue(updateRow.get('cameraModelCustom'));
            }
            if (updateRow.containsKey('dataIntegrationsRequiredOther')) {
                siteRecord.Data_integrations_required_other__c = toStringValue(updateRow.get('dataIntegrationsRequiredOther'));
            }
            if (updateRow.containsKey('shippingAddressStreet')) {
                siteRecord.Shipping_Address__Street__s = toStringValue(updateRow.get('shippingAddressStreet'));
            }
            if (updateRow.containsKey('shippingAddressCity')) {
                siteRecord.Shipping_Address__City__s = toStringValue(updateRow.get('shippingAddressCity'));
            }
            if (updateRow.containsKey('shippingAddressStateCode')) {
                siteRecord.Shipping_Address__StateCode__s = toStringValue(updateRow.get('shippingAddressStateCode'));
            }
            if (updateRow.containsKey('shippingAddressPostalCode')) {
                siteRecord.Shipping_Address__PostalCode__s = toStringValue(updateRow.get('shippingAddressPostalCode'));
            }
            if (updateRow.containsKey('shippingAddressCountryCode')) {
                siteRecord.Shipping_Address__CountryCode__s = toStringValue(updateRow.get('shippingAddressCountryCode'));
            }
            if (updateRow.containsKey('whoIsInstalling')) {
                siteRecord.Who_is_Installing__c = toStringValue(updateRow.get('whoIsInstalling'));
            }
            if (updateRow.containsKey('additionalBillingNotes')) {
                siteRecord.Additional_billing_notes__c = toStringValue(updateRow.get('additionalBillingNotes'));
            }
            if (updateRow.containsKey('nvrDvrUsername')) {
                siteRecord.NVR_DVR_Username__c = toStringValue(updateRow.get('nvrDvrUsername'));
            }
            if (updateRow.containsKey('nvrDvrPassword')) {
                siteRecord.NVR_DVR_Password__c = toStringValue(updateRow.get('nvrDvrPassword'));
            }
            if (updateRow.containsKey('nvrDvrRecordInParallelWithSrd')) {
                siteRecord.NVR_DVR_Record_In_Parallel_With_SRD__c = toBooleanValue(updateRow.get('nvrDvrRecordInParallelWithSrd'));
            }
            if (updateRow.containsKey('nvrDvrRequiredAsPoe')) {
                siteRecord.NVR_DVR_Required_as_POE__c = toBooleanValue(updateRow.get('nvrDvrRequiredAsPoe'));
            }
            if (updateRow.containsKey('permissionToResetNvrAndCameras')) {
                siteRecord.Permission_to_Reset_NVR_and_Cameras__c = toBooleanValue(updateRow.get('permissionToResetNvrAndCameras'));
            }
            if (updateRow.containsKey('headsetAudioType')) {
                siteRecord.Headset_Audio_Type__c = toStringValue(updateRow.get('headsetAudioType'));
            }
            if (updateRow.containsKey('hmeType')) {
                siteRecord.HME_Type__c = toStringValue(updateRow.get('hmeType'));
            }
            if (updateRow.containsKey('hmeUsername')) {
                siteRecord.HME_Username__c = toStringValue(updateRow.get('hmeUsername'));
            }
            if (updateRow.containsKey('hmePassword')) {
                siteRecord.HME_Password__c = toStringValue(updateRow.get('hmePassword'));
            }
            if (updateRow.containsKey('zoomIp')) {
                siteRecord.Zoom_IP__c = toStringValue(updateRow.get('zoomIp'));
            }
            if (updateRow.containsKey('siteAddressStreet')) {
                siteRecord.Site_Address__Street__s = toStringValue(updateRow.get('siteAddressStreet'));
            }
            if (updateRow.containsKey('siteAddressCity')) {
                siteRecord.Site_Address__City__s = toStringValue(updateRow.get('siteAddressCity'));
            }
            if (updateRow.containsKey('siteAddressStateCode')) {
                siteRecord.Site_Address__StateCode__s = toStringValue(updateRow.get('siteAddressStateCode'));
            }
            if (updateRow.containsKey('siteAddressPostalCode')) {
                siteRecord.Site_Address__PostalCode__s = toStringValue(updateRow.get('siteAddressPostalCode'));
            }
            if (updateRow.containsKey('siteAddressCountryCode')) {
                siteRecord.Site_Address__CountryCode__s = toStringValue(updateRow.get('siteAddressCountryCode'));
            }
            if (updateRow.containsKey('siteOpenDate')) {
                siteRecord.Site_Open_Date__c = toDateValue(updateRow.get('siteOpenDate'));
            }
            if (updateRow.containsKey('shippingContactId')) {
                siteRecord.Shipping_Contact__c = toId(updateRow.get('shippingContactId'));
            }
            if (updateRow.containsKey('installContactId')) {
                siteRecord.Install_Contact__c = toId(updateRow.get('installContactId'));
            }
            if (updateRow.containsKey('dataContactId')) {
                siteRecord.Data_Contact__c = toId(updateRow.get('dataContactId'));
            }
            if (updateRow.containsKey('billingContactId')) {
                siteRecord.Billing_Contact__c = toId(updateRow.get('billingContactId'));
            }
            if (updateRow.containsKey('accountAdministratorContactId')) {
                siteRecord.Account_Administrator__c = toId(updateRow.get('accountAdministratorContactId'));
            }
            
            sitesToUpdate.add(siteRecord);

            if (opportunitySiteId != null && updateRow.containsKey('audioTypesRequired')) {
                opportunitySitesToUpdate.add(new Opportunity_Site__c(
                    Id = opportunitySiteId,
                    Audio_Type_s_Required__c = toStringValue(updateRow.get('audioTypesRequired'))
                ));
            }
        }

        if (!sitesToUpdate.isEmpty()) {
            update sitesToUpdate;
        }
        if (!opportunitySitesToUpdate.isEmpty()) {
            update opportunitySitesToUpdate;
        }

        result.updatedCount = sitesToUpdate.size();
        return result;
    }

    private static String toStringValue(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text == '' ? null : text;
    }

    private static Id toId(Object value) {
        String text = toStringValue(value);
        return text == null ? null : (Id) text;
    }

    private static Decimal toDecimal(Object value) {
        String text = toStringValue(value);
        return text == null ? null : Decimal.valueOf(text);
    }

    private static Date toDateValue(Object value) {
        String text = toStringValue(value);
        return text == null ? null : Date.valueOf(text);
    }

    private static Boolean toBooleanValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Boolean) {
            return (Boolean) value;
        }

        String text = String.valueOf(value).trim().toLowerCase();
        if (text == '') {
            return null;
        }
        if (text == 'true' || text == '1' || text == 'yes' || text == 'y') {
            return true;
        }
        if (text == 'false' || text == '0' || text == 'no' || text == 'n') {
            return false;
        }
        throw new AuraHandledException('Invalid boolean value in submitted site update data.');
    }

    public class Request {
        @InvocableVariable(required=true)
        public Id opportunityId;

        @InvocableVariable(required=true)
        public String updatesJson;
    }

    public class Result {
        @InvocableVariable
        public Integer updatedCount;
    }

    public class RowUpdate {
        public Id opportunitySiteId;
        public Id siteId;
        public Decimal totalCamera;
        public String pointOfSaleSystem;
        public String cameraMake;
        public String cameraModel;
        public String cameraMakeCustom;
        public String cameraModelCustom;
        public String dataIntegrationsRequiredOther;
        public String shippingAddressStreet;
        public String shippingAddressCity;
        public String shippingAddressStateCode;
        public String shippingAddressPostalCode;
        public String shippingAddressCountryCode;
        public String whoIsInstalling;
        public String additionalBillingNotes;
        public String nvrDvrUsername;
        public String nvrDvrPassword;
        public Boolean nvrDvrRecordInParallelWithSrd;
        public Boolean nvrDvrRequiredAsPoe;
        public Boolean permissionToResetNvrAndCameras;
        public String headsetAudioType;
        public String hmeType;
        public String hmeUsername;
        public String hmePassword;
        public String audioTypesRequired;
        public String zoomIp;
        public String siteAddressStreet;
        public String siteAddressCity;
        public String siteAddressStateCode;
        public String siteAddressPostalCode;
        public String siteAddressCountryCode;
        public Date siteOpenDate;
        public Id shippingContactId;
        public Id installContactId;
        public Id dataContactId;
        public Id billingContactId;
        public Id accountAdministratorContactId;
    }
}