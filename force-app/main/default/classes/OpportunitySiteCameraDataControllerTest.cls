@IsTest
private class OpportunitySiteCameraDataControllerTest {
    private static String getPicklistValue(String fieldApiName) {
        Schema.DescribeFieldResult fieldDescribe =
            Site__c.SObjectType.getDescribe().fields.getMap().get(fieldApiName).getDescribe();

        for (Schema.PicklistEntry entry : fieldDescribe.getPicklistValues()) {
            if (entry.isActive()) {
                return entry.getValue();
            }
        }

        return null;
    }

    private static String getOpportunitySitePicklistValue(String fieldApiName) {
        Schema.DescribeFieldResult fieldDescribe =
            Opportunity_Site__c.SObjectType.getDescribe().fields.getMap().get(fieldApiName).getDescribe();

        for (Schema.PicklistEntry entry : fieldDescribe.getPicklistValues()) {
            if (entry.isActive()) {
                return entry.getValue();
            }
        }

        return null;
    }

    @TestSetup
    static void setupData() {
        Account accountRecord = new Account(Name = 'Camera Data Account');
        insert accountRecord;

        Opportunity opportunityRecord = new Opportunity(
            Name = 'Camera Data Opportunity',
            AccountId = accountRecord.Id,
            StageName = 'Prospecting',
            CloseDate = Date.today().addDays(30)
        );
        insert opportunityRecord;

        Site__c siteRecord = new Site__c(
            Name = 'Site One',
            Account__c = accountRecord.Id,
            Number_of_Cameras__c = 4,
            Point_of_Sale_System__c = getPicklistValue('Point_of_Sale_System__c'),
            NVR_DVR_Make__c = 'Axis',
            NVR_DVR_Model__c = 'P3245',
            NVR_DVR_Username__c = 'axis_admin',
            NVR_DVR_Password__c = 'axis_password',
            NVR_DVR_Record_In_Parallel_With_SRD__c = true,
            NVR_DVR_Required_as_POE__c = true,
            Permission_to_Reset_NVR_and_Cameras__c = false,
            Headset_Audio_Type__c = 'Analog',
            HME_Type__c = 'HME Classic',
            HME_Username__c = 'hme_user',
            HME_Password__c = 'hme_password',
            Zoom_IP__c = '192.168.1.10',
            Site_Address__Street__s = '100 Main St',
            Site_Address__City__s = 'Ottawa',
            Site_Address__StateCode__s = 'ON',
            Site_Address__PostalCode__s = 'K1A0A6',
            Site_Address__CountryCode__s = 'CA',
            Site_Open_Date__c = Date.today().addDays(-30)
        );
        insert siteRecord;

        Opportunity_Site__c opportunitySiteRecord = new Opportunity_Site__c(
            Opportunity__c = opportunityRecord.Id,
            Site__c = siteRecord.Id,
            Audio_Type_s_Required__c = getOpportunitySitePicklistValue('Audio_Type_s_Required__c')
        );
        insert opportunitySiteRecord;
    }

    @IsTest
    static void returnsOpportunitySiteCameraRows() {
        Opportunity opportunityRecord = [SELECT Id FROM Opportunity LIMIT 1];

        Test.startTest();
        List<OpportunitySiteCameraDataController.OpportunitySiteCameraRow> rows =
            OpportunitySiteCameraDataController.getOpportunitySiteCameraRows(opportunityRecord.Id);
        Test.stopTest();

        System.assertEquals(1, rows.size());
        System.assertEquals('Camera Data Account', rows[0].accountName);
        System.assertEquals('Site One', rows[0].siteName);
        System.assertEquals(4, rows[0].totalCamera);
        System.assertEquals(getPicklistValue('Point_of_Sale_System__c'), rows[0].pointOfSaleSystem);
        System.assertEquals('Axis', rows[0].cameraMake);
        System.assertEquals('P3245', rows[0].cameraModel);
        System.assertEquals('axis_admin', rows[0].nvrDvrUsername);
        System.assertEquals('axis_password', rows[0].nvrDvrPassword);
        System.assertEquals(true, rows[0].nvrDvrRecordInParallelWithSrd);
        System.assertEquals(true, rows[0].nvrDvrRequiredAsPoe);
        System.assertEquals(false, rows[0].permissionToResetNvrAndCameras);
        System.assertEquals(getOpportunitySitePicklistValue('Audio_Type_s_Required__c'), rows[0].audioTypesRequired);
        System.assertEquals('HME Classic', rows[0].hmeType);
        System.assertEquals('hme_user', rows[0].hmeUsername);
        System.assertEquals('hme_password', rows[0].hmePassword);
        System.assertEquals('192.168.1.10', rows[0].zoomIp);
        System.assertEquals('100 Main St', rows[0].siteAddressStreet);
        System.assertEquals('Ottawa', rows[0].siteAddressCity);
        System.assertEquals('ON', rows[0].siteAddressStateCode);
        System.assertEquals('K1A0A6', rows[0].siteAddressPostalCode);
        System.assertEquals('CA', rows[0].siteAddressCountryCode);
        System.assertEquals(Date.today().addDays(-30), rows[0].siteOpenDate);
    }

    @IsTest
    static void returnsEditableFieldConfig() {
        Test.startTest();
        OpportunitySiteCameraDataController.FieldConfig config =
            OpportunitySiteCameraDataController.getEditableFieldConfig();
        Test.stopTest();

        System.assertNotEquals(null, config);
        System.assertNotEquals(null, config.pointOfSaleSystemOptions);
        System.assertNotEquals(null, config.siteAddressStateCodeOptions);
        System.assertNotEquals(null, config.siteAddressCountryCodeOptions);
        System.assertNotEquals(null, config.audioTypesRequiredLabel);
        System.assertNotEquals(null, config.audioTypesRequiredOptions);
        System.assertNotEquals(null, config.fieldLabels);
        System.assertNotEquals(null, config.fieldLabels.totalCamera);
        System.assertNotEquals(null, config.fieldLabels.pointOfSaleSystem);
        System.assertNotEquals(null, config.fieldLabels.siteAddressStreet);
        System.assertNotEquals(null, config.fieldLabels.headsetAudioType);
    }

    @IsTest
    static void updatesSiteCameraData() {
        Opportunity opportunityRecord = [SELECT Id FROM Opportunity LIMIT 1];
        Site__c siteRecord = [SELECT Id FROM Site__c LIMIT 1];
        Opportunity_Site__c opportunitySiteRecord = [SELECT Id FROM Opportunity_Site__c LIMIT 1];

        OpportunitySiteCameraUpdateAction.Request request = new OpportunitySiteCameraUpdateAction.Request();
        request.opportunityId = opportunityRecord.Id;
        request.updatesJson =
            '[{"opportunitySiteId":"' + opportunitySiteRecord.Id +
            '","siteId":"' + siteRecord.Id +
            '","totalCamera":8,"pointOfSaleSystem":"' + getPicklistValue('Point_of_Sale_System__c') +
            '","cameraMake":"Hanwha","cameraModel":"XNO-8080R"' +
            ',"nvrDvrUsername":"hanwha_admin"' +
            ',"nvrDvrPassword":"hanwha_password"' +
            ',"nvrDvrRecordInParallelWithSrd":false' +
            ',"nvrDvrRequiredAsPoe":false' +
            ',"permissionToResetNvrAndCameras":true' +
            ',"audioTypesRequired":"' + getOpportunitySitePicklistValue('Audio_Type_s_Required__c') + '"' +
            ',"hmeType":"HME Cloud"' +
            ',"hmeUsername":"updated_hme_user"' +
            ',"hmePassword":"updated_hme_password"' +
            ',"zoomIp":"10.10.10.10"' +
            ',"siteAddressStreet":"200 Queen St"' +
            ',"siteAddressCity":"Toronto"' +
            ',"siteAddressStateCode":"ON"' +
            ',"siteAddressPostalCode":"M5H2N2"' +
            ',"siteAddressCountryCode":"CA"' +
            ',"siteOpenDate":"' + String.valueOf(Date.today()) + '"}]';

        Test.startTest();
        List<OpportunitySiteCameraUpdateAction.Result> results =
            OpportunitySiteCameraUpdateAction.updateCameraData(
                new List<OpportunitySiteCameraUpdateAction.Request>{ request }
            );
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals(1, results[0].updatedCount);

        Site__c updatedSite = [
            SELECT
                Number_of_Cameras__c,
                Point_of_Sale_System__c,
                NVR_DVR_Make__c,
                NVR_DVR_Model__c,
                NVR_DVR_Username__c,
                NVR_DVR_Password__c,
                NVR_DVR_Record_In_Parallel_With_SRD__c,
                NVR_DVR_Required_as_POE__c,
                Permission_to_Reset_NVR_and_Cameras__c,
                HME_Type__c,
                HME_Username__c,
                HME_Password__c,
                Zoom_IP__c,
                Site_Address__Street__s,
                Site_Address__City__s,
                Site_Address__StateCode__s,
                Site_Address__PostalCode__s,
                Site_Address__CountryCode__s,
                Site_Open_Date__c
            FROM Site__c
            WHERE Id = :siteRecord.Id
        ];
        System.assertEquals(8, updatedSite.Number_of_Cameras__c);
        System.assertEquals(getPicklistValue('Point_of_Sale_System__c'), updatedSite.Point_of_Sale_System__c);
        System.assertEquals('Hanwha', updatedSite.NVR_DVR_Make__c);
        System.assertEquals('XNO-8080R', updatedSite.NVR_DVR_Model__c);
        System.assertEquals('hanwha_admin', updatedSite.NVR_DVR_Username__c);
        System.assertEquals('hanwha_password', updatedSite.NVR_DVR_Password__c);
        System.assertEquals(false, updatedSite.NVR_DVR_Record_In_Parallel_With_SRD__c);
        System.assertEquals(false, updatedSite.NVR_DVR_Required_as_POE__c);
        System.assertEquals(true, updatedSite.Permission_to_Reset_NVR_and_Cameras__c);
        System.assertEquals('HME Cloud', updatedSite.HME_Type__c);
        System.assertEquals('updated_hme_user', updatedSite.HME_Username__c);
        System.assertEquals('updated_hme_password', updatedSite.HME_Password__c);
        System.assertEquals('10.10.10.10', updatedSite.Zoom_IP__c);
        System.assertEquals('200 Queen St', updatedSite.Site_Address__Street__s);
        System.assertEquals('Toronto', updatedSite.Site_Address__City__s);
        System.assertEquals('ON', updatedSite.Site_Address__StateCode__s);
        System.assertEquals('M5H2N2', updatedSite.Site_Address__PostalCode__s);
        System.assertEquals('CA', updatedSite.Site_Address__CountryCode__s);
        System.assertEquals(Date.today(), updatedSite.Site_Open_Date__c);

        Opportunity_Site__c updatedOpportunitySite = [
            SELECT Audio_Type_s_Required__c
            FROM Opportunity_Site__c
            WHERE Id = :opportunitySiteRecord.Id
        ];
        System.assertEquals(
            getOpportunitySitePicklistValue('Audio_Type_s_Required__c'),
            updatedOpportunitySite.Audio_Type_s_Required__c
        );
    }
}