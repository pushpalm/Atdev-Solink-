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

        for (Integer requestIndex = 0; requestIndex < requests.size(); requestIndex++) {
            try {
                results.add(processRequest(requests[requestIndex]));
            } catch (SiteCameraUpdateException handledException) {
                throw handledException;
            } catch (Exception unexpectedException) {
                // Preserve request index to help identify the failing flow element input.
                throw new SiteCameraUpdateException(
                    'Unable to update site camera data for request #' +
                    String.valueOf(requestIndex + 1) +
                    ': ' +
                    unexpectedException.getMessage()
                );
            }
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
        List<Object> requestedUpdates;
        try {
            // Untyped JSON lets us accept blank values and convert per-field safely below.
            requestedUpdates = (List<Object>) JSON.deserializeUntyped(request.updatesJson);
        } catch (Exception jsonException) {
            throw new SiteCameraUpdateException('The uploaded update payload is invalid JSON.');
        }

        List<Site__c> sitesToUpdate = new List<Site__c>();
        List<Opportunity_Site__c> opportunitySitesToUpdate = new List<Opportunity_Site__c>();
        Integer rowNumber = 1;
        for (Object rowObject : requestedUpdates) {
            if (!(rowObject instanceof Map<String, Object>)) {
                rowNumber++;
                continue;
            }
            try {
                Map<String, Object> updateRow = (Map<String, Object>) rowObject;

                Id opportunitySiteId = toId(updateRow.get('opportunitySiteId'));
                Id resolvedSiteId = toId(updateRow.get('siteId'));
                if (resolvedSiteId == null && opportunitySiteId != null) {
                    resolvedSiteId = siteIdByOpportunitySiteId.get(opportunitySiteId);
                }

                if (resolvedSiteId == null) {
                    rowNumber++;
                    continue;
                }

                // Reject any record that does not belong to the current opportunity so
                // the flow cannot be used to update unrelated sites.
                if (!allowedSiteIds.contains(resolvedSiteId)) {
                    throw new SiteCameraUpdateException(
                        'Row ' + String.valueOf(rowNumber) + ': submitted site is not related to this opportunity.'
                    );
                }

                Site__c siteRecord = new Site__c(
                    Id = resolvedSiteId,
                    Number_of_Cameras__c = toDecimal(updateRow.get('totalCamera')),
                    Point_of_Sale_System__c = toStringValue(updateRow.get('pointOfSaleSystem')),
                    NVR_DVR_Make__c = toStringValue(updateRow.get('cameraMake')),
                    NVR_DVR_Model__c = toStringValue(updateRow.get('cameraModel')),
                    Camera_Make__c = toStringValue(updateRow.get('cameraMakeCustom')),
                    Camera_Model__c = toStringValue(updateRow.get('cameraModelCustom')),
                    Data_integrations_required_other__c = toStringValue(updateRow.get('dataIntegrationsRequiredOther')),
                    Shipping_Address__Street__s = toStringValue(updateRow.get('shippingAddressStreet')),
                    Shipping_Address__City__s = toStringValue(updateRow.get('shippingAddressCity')),
                    Shipping_Address__StateCode__s = toStringValue(updateRow.get('shippingAddressStateCode')),
                    Shipping_Address__PostalCode__s = toStringValue(updateRow.get('shippingAddressPostalCode')),
                    Shipping_Address__CountryCode__s = toStringValue(updateRow.get('shippingAddressCountryCode')),
                    Who_is_Installing__c = toStringValue(updateRow.get('whoIsInstalling')),
                    Additional_billing_notes__c = toStringValue(updateRow.get('additionalBillingNotes')),
                    NVR_DVR_Username__c = toStringValue(updateRow.get('nvrDvrUsername')),
                    NVR_DVR_Password__c = toStringValue(updateRow.get('nvrDvrPassword')),
                    NVR_DVR_Record_In_Parallel_With_SRD__c = toBooleanValue(updateRow.get('nvrDvrRecordInParallelWithSrd')),
                    NVR_DVR_Required_as_POE__c = toBooleanValue(updateRow.get('nvrDvrRequiredAsPoe')),
                    Permission_to_Reset_NVR_and_Cameras__c = toBooleanValue(updateRow.get('permissionToResetNvrAndCameras')),
                    Headset_Audio_Type__c = toStringValue(updateRow.get('headsetAudioType')),
                    HME_Type__c = toStringValue(updateRow.get('hmeType')),
                    HME_Username__c = toStringValue(updateRow.get('hmeUsername')),
                    HME_Password__c = toStringValue(updateRow.get('hmePassword')),
                    Zoom_IP__c = toStringValue(updateRow.get('zoomIp')),
                    Site_Address__Street__s = toStringValue(updateRow.get('siteAddressStreet')),
                    Site_Address__City__s = toStringValue(updateRow.get('siteAddressCity')),
                    Site_Address__StateCode__s = toStringValue(updateRow.get('siteAddressStateCode')),
                    Site_Address__PostalCode__s = toStringValue(updateRow.get('siteAddressPostalCode')),
                    Site_Address__CountryCode__s = toStringValue(updateRow.get('siteAddressCountryCode')),
                    Site_Open_Date__c = toDateValue(updateRow.get('siteOpenDate')),
                    Shipping_Contact__c = toId(updateRow.get('shippingContactId')),
                    Install_Contact__c = toId(updateRow.get('installContactId')),
                    Data_Contact__c = toId(updateRow.get('dataContactId')),
                    Billing_Contact__c = toId(updateRow.get('billingContactId')),
                    Account_Administrator__c = toId(updateRow.get('accountAdministratorContactId'))
                );
                sitesToUpdate.add(siteRecord);

                if (opportunitySiteId != null) {
                    opportunitySitesToUpdate.add(new Opportunity_Site__c(
                        Id = opportunitySiteId,
                        Audio_Type_s_Required__c = toStringValue(updateRow.get('audioTypesRequired'))
                    ));
                }
            } catch (SiteCameraUpdateException rowHandledException) {
                throw rowHandledException;
            } catch (Exception rowException) {
                throw new SiteCameraUpdateException(
                    'Row ' + String.valueOf(rowNumber) + ': ' + rowException.getMessage()
                );
            }
            rowNumber++;
        }

        if (!sitesToUpdate.isEmpty()) {
            Database.SaveResult[] siteSaveResults = Database.update(sitesToUpdate, false);
            // Return all save failures together instead of failing fast on the first row.
            List<String> saveErrors = collectSaveErrors(siteSaveResults, 'Site');
            if (!saveErrors.isEmpty()) {
                throw new SiteCameraUpdateException('Failed to update site camera data:\n- ' + String.join(saveErrors, '\n- '));
            }
        }
        if (!opportunitySitesToUpdate.isEmpty()) {
            Database.SaveResult[] opportunitySiteSaveResults = Database.update(opportunitySitesToUpdate, false);
            List<String> saveErrors = collectSaveErrors(opportunitySiteSaveResults, 'Opportunity Site');
            if (!saveErrors.isEmpty()) {
                throw new SiteCameraUpdateException('Failed to update opportunity site data:\n- ' + String.join(saveErrors, '\n- '));
            }
        }

        result.updatedCount = sitesToUpdate.size();

        if (result.updatedCount > 0) {
            notifyOwnerIfExternalUser(request.opportunityId, result.updatedCount);
        }

        return result;
    }

    private static void notifyOwnerIfExternalUser(Id opportunityId, Integer updatedCount) {
        if (UserInfo.getUserType() == 'Standard') {
            return;
        }
        String submitterName = UserInfo.getFirstName() + ' ' + UserInfo.getLastName();
        sendOwnerNotificationAsync(opportunityId, updatedCount, submitterName);
    }

    @future
    private static void sendOwnerNotificationAsync(Id opportunityId, Integer updatedCount, String submitterName) {
        List<Opportunity> opps = [
            SELECT Name, Owner.Email
            FROM Opportunity
            WHERE Id = :opportunityId
            LIMIT 1
        ];
        if (opps.isEmpty() || String.isBlank(opps[0].Owner.Email)) {
            return;
        }
        Opportunity opp = opps[0];
         List<Messaging.SendEmailResult> results = new  List<Messaging.SendEmailResult>();
         System.debug(LoggingLevel.INFO, 'Email: ' + opp.Owner.Email );
        String subject = 'Site details submitted for Opportunity ' + opp.Name;
        String body = 'Site details have been submitted for Opportunity ' + opp.Name + '<br/>' +
            'Updated Site Count: ' + String.valueOf(updatedCount) + '<br/>' +
            'Submitted By: ' + submitterName + '<br/>' +
            'Submitted At: ' + String.valueOf(Datetime.now());

        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setToAddresses(new List<String>{ opp.Owner.Email });
        email.setSubject(subject);
        email.setHtmlBody(body);
        email.setSaveAsActivity(false);
        System.debug(LoggingLevel.INFO, 'body: ' + email );
        results = Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ email });
        for (Messaging.SendEmailResult r : results) {
        if (!r.isSuccess()) {
            System.debug('Error: ' + r.getErrors());
        }
        }
 //       Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ email });
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
        throw new SiteCameraUpdateException(
            'Invalid boolean value "' + String.valueOf(value) + '" in submitted site update data.'
        );
    }

    private static List<String> collectSaveErrors(Database.SaveResult[] saveResults, String recordTypeLabel) {
        List<String> errors = new List<String>();
        for (Integer index = 0; index < saveResults.size(); index++) {
            if (saveResults[index].isSuccess()) {
                continue;
            }

            for (Database.Error saveError : saveResults[index].getErrors()) {
                errors.add(
                    recordTypeLabel + ' row #' + String.valueOf(index + 1) + ': ' + saveError.getMessage()
                );
            }
        }
        return errors;
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

    public class SiteCameraUpdateException extends Exception {}

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