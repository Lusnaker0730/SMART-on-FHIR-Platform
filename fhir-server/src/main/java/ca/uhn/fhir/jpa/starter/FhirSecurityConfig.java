package ca.uhn.fhir.jpa.starter;

import ca.uhn.fhir.interceptor.api.IServerInterceptor; // <-- 必須有此行來解決 "cannot find symbol"
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FhirSecurityConfig {

    @Autowired
    private OAuth2Provider oAuth2Provider;

    @Bean
    public IServerInterceptor oAuth2SecurityInterceptor() { 
        return oAuth2Provider;
    }
}