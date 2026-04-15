public with sharing class SiteDetailsEmailSendAction {
    @InvocableMethod(label='Send Site Details Email')
    public static List<Result> sendEmail(List<Request> requests) {
        List<Result> results = new List<Result>();

        for (Request request : requests) {
            Result result = new Result();
            result.sentCount = 0;

            if (request == null || String.isBlank(request.toAddress) || String.isBlank(request.subject)) {
                results.add(result);
                continue;
            }

            Messaging.SingleEmailMessage emailMessage = new Messaging.SingleEmailMessage();
            emailMessage.setToAddresses(new List<String>{ request.toAddress.trim() });
            emailMessage.setSubject(request.subject);
            emailMessage.setHtmlBody(String.isBlank(request.htmlBody) ? '' : request.htmlBody);
            emailMessage.setSaveAsActivity(false);

            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ emailMessage });
            result.sentCount = 1;
            results.add(result);
        }

        return results;
    }

    public class Request {
        @InvocableVariable(required=true)
        public String toAddress;

        @InvocableVariable(required=true)
        public String subject;

        @InvocableVariable(required=false)
        public String htmlBody;
    }

    public class Result {
        @InvocableVariable
        public Integer sentCount;
    }
}