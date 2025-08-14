# NSUTTHON Backend

This repository contains the backend code for NSUTTHON: Crosslinks, NSUT’s flagship event for freshers at NSUT, Delhi. The backend is built with Node.js, Express, and PostgreSQL.

## 🚀 Getting Started

These instructions will help you set up and run the project on your local machine for development and testing purposes.

### Prerequisites

Ensure you have Node.js and npm installed. If not, download and install them from [nodejs.org](https://nodejs.org/).

### Installing

1. Clone the repository:

   ```sh
   git clone https://github.com/nemeziz1010/NSUTTHON-BACKEND
   cd NSUTTHON-BACKEND
   ```

2. Install the dependencies:

   ```sh
   npm install
   ```

### Configuration

1. Create a `.env` file in the project root:

   ```sh
   touch .env
   ```

2. Add the following environment variables to the `.env` file:

   ```ini
   DATABASE_URL=postgres://username:password@localhost/dbname
   JWT_SECRET=your_jwt_secret
   SMTP_EMAIL=your_smtp_email
   PASSWORD=your_email_password
   SMTP_HOST=your_smtp_host
   SMTP_PORT=your_smtp_port
   GCP_SERVICE_ACCOUNT_KEY_PATH=path_to_your_gcp_service_account_key_file
   GCP_PROJECT_ID=your_gcp_project_id
   GCP_BUCKET_NAME=your_gcp_bucket_name
   ```

   Ensure to secure your environment variables, especially sensitive information like JWT secrets and database credentials.

## 🛠 Tech Stack

- **Database**: PostgreSQL
- **Backend**: Node.js + Express

## 📜 License

This project is open source and available under the MIT License.

## 📞 Contact

For queries or suggestions, feel free to reach out to the Crosslinks NSUT team.

## 🤝 Contributing

Contributions are welcome! Open an issue, create a pull request, or help with documentation. Every bit helps!
