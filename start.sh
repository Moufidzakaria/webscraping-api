#!/bin/bash

# Lancer les services Docker
docker compose up -d

# Vérifier si Portainer existe déjà
if [ $(docker ps -a -q -f name=portainer) ]; then
    echo "Portainer est déjà lancé."
else
    echo "Lancement de Portainer..."
    docker run -d \
      -p 9000:9000 \
      --name portainer \
      --restart=always \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -v portainer_data:/data \
      portainer/portainer-ce:latest
fi

# Afficher les containers actifs
docker ps

