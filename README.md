# Car Service Telecalling Platform - Backend

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the backend directory (use `.env.example` as reference):

```bash
cp .env.example .env
```

Then fill in your actual values for:
- `DATABASE_URL` - Your Neon DB connection string
- `JWT_SECRET` - A secure random string
- `GEMINI_API_KEY` - Your Google Gemini API key
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` - Your Cloudflare R2 credentials

### 3. Set Up Database
```bash
# Generate Prisma client
npm run prisma:generate

# Push schema to database
npm run prisma:push

# Seed database with sample data (2 telecallers + ~50 customers)
npm run prisma:seed
```

### 4. Run Development Server
```bash
npm run dev
```

The server will start on `http://localhost:5000`

## Default Login Credentials

After seeding, use these credentials to log in:

**Telecaller 1:**
- Username: `telecaller1`
- Password: `password123`

**Telecaller 2:**
- Username: `telecaller2`
- Password: `password123`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Customers
- `GET /api/customers/due-for-service?days=7` - Get customers due for service
- `GET /api/customers/:id` - Get customer details

### Documents
- `POST /api/documents/upload` - Upload PDF documents
- `GET /api/documents/:customerId` - Get customer documents

### Insights
- `POST /api/insights/generate` - Generate AI insights from PDFs
- `GET /api/insights/:customerId` - Get customer insights

### Calls
- `POST /api/calls/log` - Log a call
- `GET /api/calls/:customerId` - Get customer call history

## Notes

- All API endpoints except `/api/auth/login` require JWT authentication
- Include the JWT token in the `Authorization` header as `Bearer <token>`
- PDF files are uploaded to Cloudflare R2 storage
- AI insights are generated using Google's Gemini 1.5 Flash model
