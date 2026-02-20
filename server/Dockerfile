# Use official Node.js runtime
FROM node:18

# Create app directory inside container
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the code
COPY . .

# Cloud Run expects PORT env
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "index.js"]