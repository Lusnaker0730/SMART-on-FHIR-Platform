package ca.uhn.fhir.jpa.starter;

import ca.uhn.fhir.interceptor.api.Hook;
import ca.uhn.fhir.interceptor.api.Pointcut;
import ca.uhn.fhir.rest.api.RestOperationTypeEnum;
import ca.uhn.fhir.rest.api.server.RequestDetails;
import ca.uhn.fhir.rest.api.server.ResponseDetails;
import ca.uhn.fhir.rest.server.exceptions.AuthenticationException;
import ca.uhn.fhir.rest.server.interceptor.auth.AuthorizationInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component
public class OAuth2Provider extends AuthorizationInterceptor {

    /**
     * 在請求處理之前執行，檢查 Authorization 標頭
     */
    @Hook(Pointcut.SERVER_INCOMING_REQUEST_POST_PROCESSED)
    public void checkRequest(HttpServletRequest theRequest) {
        String authHeader = theRequest.getHeader("Authorization");
        
        // 1. 檢查是否存在 Bearer Token
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            // 如果沒有 Token，則拋出 401 Unauthorized
            throw new AuthenticationException("Missing Bearer Token in Authorization header.");
        }
        
        String token = authHeader.substring(7);

        // 2. 驗證 JWT 簽名、過期時間和 Issuer
        if (!JwtUtils.validateToken(token)) {
            // 如果驗證失敗，則拋出 401 Unauthorized
            throw new AuthenticationException("Invalid or expired OAuth2 Token.");
        }
        
        // 如果驗證成功，則請求繼續
    }

    /**
     * 實作 AuthorizationInterceptor 的抽象方法: 處理發送的響應
     * 修正點：使用完整的類別路徑作為參數類型，避免編譯錯誤
     */
    @Override
    public boolean outgoingResponse(ca.uhn.fhir.rest.api.server.RequestDetails theRequest, ca.uhn.fhir.rest.api.server.ResponseDetails theResponse) {
        return true;
    }
    /**
     * 實作 AuthorizationInterceptor 的抽象方法: 定義授權規則
     * 修正點：使用完整的類別路徑引用 RestOperationTypeEnum 和 ALL
     */
    @Override
    public List<ca.uhn.fhir.rest.api.RestOperationTypeEnum> buildRuleList() {
        return Collections.singletonList(ca.uhn.fhir.rest.api.RestOperationTypeEnum.ALL);
    }
}