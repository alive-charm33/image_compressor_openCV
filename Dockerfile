# Use a lightweight Node.js base image
FROM node:20-slim

# Install Python, pip, and OpenCV system dependencies (libgl1 and libglib2)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Create a virtual environment for Python and install opencv-python-headless
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir opencv-python-headless

# Copy the rest of the application files
COPY . .

# Expose the server port (process.env.PORT is automatically respected by server.js)
EXPOSE 3005

# Start the server
CMD ["node", "server.js"]
