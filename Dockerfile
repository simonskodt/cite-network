# Use a Maven image to build the project
FROM maven:3.8.6-openjdk-17 AS build

# Set the working directory in the container
WORKDIR /app

# Copy the pom.xml and source code into the container
COPY pom.xml .
COPY src ./src

# Run the Maven build
RUN mvn clean package

# Use a slim JDK image to run the application
FROM openjdk:17-jdk-slim

# Copy the built JAR file from the build stage
COPY --from=build /app/target/*.jar app.jar

# Set the entry point to run the application
ENTRYPOINT ["java","-jar","/app.jar"]