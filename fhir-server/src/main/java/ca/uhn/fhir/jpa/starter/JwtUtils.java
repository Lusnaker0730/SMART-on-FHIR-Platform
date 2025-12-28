package ca.uhn.fhir.jpa.starter;

import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.SignedJWT;

import java.net.URL;
import java.security.interfaces.RSAPublicKey;
import java.text.ParseException;
import java.util.Date;

public class JwtUtils {

    // Keycloak 的 JWKS URI，用於下載公鑰
    // 注意：這裡使用容器內部網路名稱 keycloak
    private static final String JWKS_URL = "http://keycloak:8080/realms/fhir/protocol/openid-connect/certs";

    public static boolean validateToken(String token) {
        try {
            SignedJWT jwt = SignedJWT.parse(token);

            // 1. 檢查 Token 有沒有過期 (Expiration)
            Date expirationTime = jwt.getJWTClaimsSet().getExpirationTime();
            if (expirationTime == null || expirationTime.before(new Date())) {
                System.out.println("Token Expired or missing expiration claim.");
                return false;
            }
            
            // 2. 檢查 Issuer (可選：確保是 Keycloak 發出的)
            String issuer = jwt.getJWTClaimsSet().getIssuer();
            if (issuer == null || !issuer.equals("http://keycloak:8080/realms/fhir")) {
                 System.out.println("Token has invalid issuer.");
                 return false;
            }


            // 3. 驗簽
            // 從 JWKS_URL 下載公鑰集合。注意：在生產環境中，應快取此 JWKSet 以提高性能。
            JWKSet jwkSet = JWKSet.load(new URL(JWKS_URL));
            
            // 取得 Key ID (kid)
            // 修正點：使用 getKeyID()
            String keyId = jwt.getHeader().getKeyID(); 
            
            // 從 JWKSet 中找到對應的 Key ID (kid)
            JWK jwk = jwkSet.getKeyByKeyId(keyId); 
            
            if (jwk == null || !(jwk instanceof RSAKey)) {
                System.out.println("JWK not found for kid: " + keyId + " or is not an RSA key.");
                return false;
            }
            
            RSAKey rsaKey = (RSAKey) jwk;
            RSAPublicKey publicKey = rsaKey.toRSAPublicKey();
            
            // 使用公鑰建立驗簽器
            JWSVerifier verifier = new RSASSAVerifier(publicKey);
            
            // 執行驗簽
            return jwt.verify(verifier);

        } catch (ParseException e) {
            System.err.println("Failed to parse JWT: " + e.getMessage());
            return false;
        } catch (Exception e) {
            System.err.println("JWT Validation failed: " + e.getMessage());
            // 通常是連線到 Keycloak 失敗 (JWKS_URL) 或 I/O 錯誤
            return false;
        }
    }
}