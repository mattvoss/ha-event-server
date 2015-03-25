#!/usr/bin/python
# simple script to monitor incoming X10 data, and log it to database
# written by Rob Dickerson 2009

import sys
import time
import serial
import binascii
from time import strftime

import atexit

class X10Logger:
	def __init__(self, port, logfile = 'x10.dat'):
		self.logfile = logfile
		self.f = open(self.logfile, 'w')
		# configure the serial connections (the parameters differs on the device you are connecting to)
		self.ser = serial.Serial(
			port='/dev/ttyS0',
			baudrate=4800,
			parity=serial.PARITY_NONE,
			stopbits=serial.STOPBITS_ONE,
			bytesize=serial.EIGHTBITS
			)

		#self.ser.open()

	def close():
		print("Shutting down the X10 logger...")
		self.ser.close()
		self.f.close()

	def run(self):
		if self.ser.isOpen():
			print("W800RF32 device connection open")

			#self.ser.write("F0".decode('hex'))
			#self.ser.write("29".decode('hex'))

			#handshk = self.ser.read(1).encode('hex')

			#if handshk == '29': # check if the return code is 0x29
			#	print("Handshake was successful")
			#else:
			#	print("Error handshaking with device")
	
			print("Logging data...")

			out = ''
			while 1:
				while self.ser.inWaiting() > 0:
					out += self.ser.read(4)

					if out != '':
						recv = out.encode('hex')
		
						house = (int(recv,16) & (0xFF000000)) >> (8*3+4)
		
						houseCode =  {0x6 : 'A', 0x7 : 'B', 0x4 : 'C',
						0x5 : 'D', 0x8 : 'E', 0x9 : 'F',
						0xA : 'G', 0xB : 'H', 0xE : 'I',
						0xF : 'J', 0xC : 'K', 0xD : 'L',
						0x0 : 'M', 0x1 : 'N', 0x2 : 'O',
						0x3 : 'P'}
						try:		
							house = houseCode[house];
						except KeyError:
							house = 'unknown id'
						unit1 = (int(recv,16) & (0x00004000)) >> (8+4)
						unit2 = (int(recv,16) & (0x00000800)) >> (8+2)
						unit3 = (int(recv,16) & (0x00001000)) >> (8+4)
	
						unit = unit1 | unit2 | unit3
		
						hwCode = house + str(unit+1)
						cur_time = int(time())
						print(cur_time, house, houseCode)
						f.write(cur_time + '\t' + house + '\t' + houseCode)
	
def displayUsage():
	print('''
	Usage:
	python x10logger.py port_name log_file_name
	i.e.
	python x10logger.py /dev/ttyS0 mylog.dat
	
	All rights reserved.
	http://www.robertdickerson.net
	''')		
			
def main():
	from sys import argv
	if len(argv) == 3:
		logFile = argv[1]
		logger = X10Logger(logFile)
		logger.run()		
	else:
		displayUsage()
		
if __name__ == "__main__":
	main()
