FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install -g http-server
EXPOSE 8085
CMD ["http-server", "-p", "8085", "-a", "0.0.0.0", "-c-1"]