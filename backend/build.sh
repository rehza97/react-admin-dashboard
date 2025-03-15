set -o errexit

pip install -r req.txt

python manage.py collectstatic --no-input

python manage.py migrate

if [[ $CREATE_SUPERUSER == "True" ]]; 
then
    python manage.py createsuperuser --no-input
    echo "Superuser created"
else
    echo "Superuser not created"
fi