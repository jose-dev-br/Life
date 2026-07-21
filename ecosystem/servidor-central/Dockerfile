FROM python:3.12-slim

WORKDIR /app
COPY server.py db.py auth.py parse_srm.py ./

# Nenhuma dependência externa -- o server.py usa só a stdlib de propósito,
# então não tem requirements.txt nem pip install aqui.

EXPOSE 8000
CMD ["python3", "server.py"]
