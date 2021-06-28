FROM python:3.8.1

ARG PYPI_USERNAME
ARG PYPI_PASSWORD

WORKDIR /usr/src/app

COPY . .

RUN python -m pip install -r requirements.txt

RUN nawah packages install

EXPOSE 8081

CMD [ "nawah", "launch" ]
