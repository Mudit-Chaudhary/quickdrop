FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -B

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/quickdrop-1.0.0.jar app.jar
RUN useradd -r -s /usr/sbin/nologin appuser
USER appuser
EXPOSE 8080
ENV JAVA_OPTS="-Xmx350m -Xss256k -XX:+UseContainerSupport -XX:+UseSerialGC -Djava.security.egd=file:/dev/./urandom"
ENTRYPOINT java $JAVA_OPTS -jar app.jar
