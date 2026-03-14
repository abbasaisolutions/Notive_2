FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
COPY requirements-advanced.txt ./

ARG INSTALL_ADVANCED_MODELS=false
ARG SPACY_MODEL=en_core_web_sm

RUN pip install --no-cache-dir -r requirements.txt \
    && if [ "$INSTALL_ADVANCED_MODELS" = "true" ]; then pip install --no-cache-dir -r requirements-advanced.txt; fi \
    && python -m spacy download ${SPACY_MODEL}

ENV SPACY_MODEL=${SPACY_MODEL}

COPY app.py ./

EXPOSE 8001

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
