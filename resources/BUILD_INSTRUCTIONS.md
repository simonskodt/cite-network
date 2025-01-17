# Build and Run Instructions

## Prerequisites

- Java Development Kit (JDK) 8 or higher
- Maven
- Neo4J (ensure you have a running instance)

## Setup

1. **Clone the repository:**
    ```sh
    git clone https://github.com/yourusername/cite-network.git
    cd cite-network
    ```

2. **Install dependencies:**
    Download and install Maven from [Maven's official website](https://maven.apache.org/download.cgi).

3. **Build the project:**
    ```sh
    mvn clean install
    ```

## Running the Application

1. **Run the application:**
    ```sh
    mvn spring-boot:run
    ```

2. **Configure Neo4J connection:**
    Update your `application.properties` file with the correct Neo4J connection details.

## Environment Variables for Database

1. **Create a `.env` file:**
    ```sh
    NEO4J_URI=<url>
    NEO4J_USERNAME=<dbname>
    NEO4J_PASSWORD=<password>
    ```
    Replace `<url>`, `<dbname>`, and `<password>` with your actual database details.

2. **Load environment variables:**
    ```sh
    export $(cat .env | xargs)
    ```

Ensure the environment variables are correctly loaded before running the application.
