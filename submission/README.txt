COMP0228 Coursework 1, Group 06
Error Correction over a Screen-to-Camera Optical Channel
Muhammad Maaz, Kanav Mehta and Daniel Helmi

Files

gridlink-report.pdf
The group report, 6 pages in IEEE two column format.

gridlink-code.zip
The code. src/gridlink holds the transmitter (transmitter.py), the receiver (receiver.py and
the optical folder), the frame format (protocol.py), the error correcting codes (the coding
folder) and the experiment code (the experiments folder). The tests are in tests. The scripts
that rebuild the report figures and tables are in report. The README inside the zip explains
how to install it and run the commands.

gridlink-slides.pptx
The 36 slides of the presentation. Slide 15 plays a replay
of one recorded run. It is a replay drawn from the recorded data and it is not a live run.

gridlink-data.zip
The recorded sessions behind every number in the report, with a DATA-README.txt that says what
each folder is and how the groups G01 to G29 map to them.

The setup
Every run used one chain. Laptop 1 flashes a black and white patch in front of an iPad. The
front camera of the iPad is open and shows laptop 1 live. The built-in webcam of laptop 2 films
the iPad screen, and our software on laptop 2 reads that picture.

Running the code
Unzip gridlink-code.zip, then in that folder run
python -m pip install -e ".[dev]"
python -m pytest
All 84 tests should pass. To rebuild the report, unpack gridlink-data.zip inside the experiments
folder and follow the steps in DATA-README.txt.
