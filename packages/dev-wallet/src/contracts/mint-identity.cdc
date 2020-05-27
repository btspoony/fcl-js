import IdentityContract from 0x01

transaction {
    prepare(acct: AuthAccount) {
        IdentityContract.mintIdentityAndSaveAndLink(
            account: acct,
            name: "Jeff123",
            avatar: "JeffAvatar.png",
            cover: "JeffCover.png",
            color: "#FFFFFF",
            bio: "Go With The Flow",
            authorizations: [IdentityContract.createAuthenticationHook(
                id: "auth-id",
                addr: "auth-addr",
                method: "auth-method",
                endpoint: "auth-endpoint",
                data: {
                    "key": "val"
                }
            )]
        )
    }
    
    post {
        // Check that the capabilities were created correctly
        getAccount(0x01).getCapability(/public/Identity)!
                        .check<&IdentityContract.Identity{IdentityContract.PublicIdentity}>():  
                        "Identity Reference was not created correctly"
    }
}
 