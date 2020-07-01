#!/bin/sh

# I was having issues using sed to grab the first occurence of a block using {% block .* %} {% %}. 
# While this method adds a couple lines of code, it also allows for  
declare -a blockTitles=("css" "title" "navbarTitle" "content" "js")

# Iterate over all files in the supplied directory
for filename in $1*.html; do

	# If the file is template.html, ignore
	if [[ $filename != "$1template.html" ]]; then

		# Initialize basic data
		blockData=""
		isInsideBlock=false
		blockIndex=0
		tmpFilename=${filename::-5}'_tmp.html'

		# Copy template file into a temporary file 
		cp $1template.html $tmpFilename

		# Open html file and read line by line
		while IFS= read -r line; do
			# If we read a {% end %} then, we can initiate 
			if [[ "$line" == *"{% end %}"* ]]; then
				isInsideBlock=false

				# If content block, remove the last four \t escape characters
				if [ ${blockTitles[blockIndex]} == "content" ]; then
					blockData=${blockData::-8}
				fi

				# Replace thing
				# {...::-2} Ensures we remove the \n escape character from the last line
				sed -i "s~{% block ${blockTitles[blockIndex]} %} {% end %}~${blockData::-2}~g" $tmpFilename
				
				# Increment our counter to keep track of which block we are on
				blockIndex=$((blockIndex+1))
			fi

			# When we are reading inside a block, append data to blockData
			# We also want to make sure we aren't reading an empty block and writing a '{% end %}' into an output file
			if [[ $isInsideBlock == true ]]; then
				blockData=${blockData}$line
				blockData=${blockData}'\n'
				
				# If we are in the content block, we need to add four \t escape characters to make the output file look pretty
				if [ ${blockTitles[blockIndex]} == "content" ]; then
					blockData=${blockData}'\t\t\t\t'
				fi
			fi

			# If we read {$ block, we know that the next line will be inside a block
			if [[ "$line" == *"{% block"* ]]; then
				isInsideBlock=true
				blockData=""
			fi
		done < $filename

		# Move the temporary file to the original file
		mv $tmpFilename $filename
	fi
done

# Remove template.html from bucket, not needed anymore
rm $1template.html