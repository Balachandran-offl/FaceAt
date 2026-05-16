from pyspark.sql import SparkSession

spark = SparkSession.builder \
    .appName("FaceAttendance") \
    .getOrCreate()

data = [
    ("Bala", 101),
    ("Arun", 102)
]

df = spark.createDataFrame(data, ["Name", "ID"])

df.show()

spark.stop()