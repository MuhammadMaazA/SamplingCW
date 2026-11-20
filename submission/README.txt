COMP0228 Coursework 1, Group 06
Error Correction over a Screen-to-Camera Optical Channel
Muhammad Maaz, Kanav Mehta and Daniel Helmi

Files

group06-report.pdf
The group report, 6 pages in IEEE two column format.

group06-code.zip
The code. src/screencam holds the transmitter (transmitter.py), the receiver (receiver.py and
the optical folder), the frame format (protocol.py), the error correcting codes (the coding
folder) and the experiment code (the experiments folder).

group06-slides.pptx
The 36 slides of the presentation. Slide 15 plays a replay
of one recorded run. It is a replay drawn from the recorded data and it is not a live run.

group06-data.zip
The recorded sessions behind every number in the report. Each session folder holds plan.json,
capture.csv, results.csv, summary.csv, session.json and the logs.

The setup
Every run used one chain. Laptop 1 flashes a black and white patch in front of an iPad. The
front camera of the iPad is open and shows laptop 1 live. The built-in webcam of laptop 2 films
the iPad screen, and our software on laptop 2 reads that picture.

Running the code
Unzip group06-code.zip, then in that folder run
python -m pip install -e ".[analysis]"
screencam --help
The screencam command has transmit, receive, calibrate, plan, transmit-plan, record, analyse and
report. To decode a recording again, unpack group06-data.zip inside the experiments folder and
run screencam analyse with the plan.json and capture.csv of that session.
