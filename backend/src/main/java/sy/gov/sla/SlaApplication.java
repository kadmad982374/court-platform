package sy.gov.sla;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class SlaApplication {
    public static void main(String[] args) {
        SpringApplication.run(SlaApplication.class, args);
    }
}

