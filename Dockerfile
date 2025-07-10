FROM node:18

# Install dependencies for containerlab
RUN apt-get update && apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    openssh-client \
    iproute2 \
    && rm -rf /var/lib/apt/lists/*

# Install containerlab
RUN bash -c "$(curl -sL https://get.containerlab.dev)" -- -v 0.48.6

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Ensure uploads directory exists
RUN mkdir -p uploads

# Expose the port the app runs on
EXPOSE 3001

# Command to run the application
CMD ["node", "server.js"] 