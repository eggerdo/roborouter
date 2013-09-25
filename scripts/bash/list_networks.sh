#!/bin/bash

RESULT=`wpa_cli list_networks`

arr=$(echo $RESULT | tr "\n")

for x in $arr
do
    network=$(echo $x | tr "\t")
    for n in $network
    do
    	
    done
done