public with sharing class CheckExternalUserAction {

    @InvocableMethod(label='Check If External User' description='Returns whether the running user is an external (portal/community) user')
    public static List<Result> checkUser(List<Request> requests) {
        String userType = UserInfo.getUserType();
        Result r = new Result();
        r.isExternalUser = (userType != 'Standard');
        r.userType = userType;

        List<Result> results = new List<Result>();
        for (Integer i = 0; i < requests.size(); i++) {
            results.add(r);
        }
        return results;
    }

    public class Request {
        @InvocableVariable(label='Placeholder' description='Not used' required=false)
        public String placeholder;
    }

    public class Result {
        @InvocableVariable(label='Is External User')
        public Boolean isExternalUser;

        @InvocableVariable(label='User Type')
        public String userType;
    }
}